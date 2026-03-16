import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
app.use(cors());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'Aura Proxy is breathing', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 8080;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('WARNING: Supabase credentials entirely missing. Proxy auth will fail.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize Google Gen AI SDK for Vertex AI
const project = process.env.GOOGLE_CLOUD_PROJECT || 'ocellus-488718';
const location = 'us-central1';

const ai = new GoogleGenAI({
    vertexai: true,
    project: project,
    location: location,
});

const server = app.listen(PORT, () => {
    console.log(`Aura Proxy listening on port ${PORT}`);
});

// Create WebSocket server. SDK might connect to different paths, so we handle all paths.
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

wss.on('connection', async (ws, req) => {
    console.log(`New client connection to: ${req.url}`);

    // ── Proxy Authentication (Supabase JWT) ──
    const authHeader = req.headers['sec-websocket-protocol'];
    const urlParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
    let clientJwt = urlParams.get('key') || urlParams.get('jwt');

    if (!clientJwt && authHeader) {
        const protocols = authHeader.split(',').map(p => p.trim());
        if (protocols.length >= 2 && protocols[0] === 'jwt') {
            clientJwt = protocols[1];
        } else if (protocols.length === 1 && protocols[0].length > 20) {
            clientJwt = protocols[0];
        }
    }


    if (!clientJwt) {
        console.warn('Client rejected: No JWT found in sec-websocket-protocol');
        ws.close(4001, 'Unauthorized: Missing JWT');
        return;
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(clientJwt);
    
    if (authError || !user) {
        console.warn('Client rejected: Invalid JWT', authError?.message);
        ws.close(4001, 'Unauthorized: Invalid Token');
        return;
    }
    
    console.log(`Authenticated user: ${user.id}`);

    // ── Fetch User Context (Preferences & Memory) ──
    let userContextStr = "";
    try {
        const { data: prefs } = await supabase
            .from('accessibility_preferences')
            .select('speech_rate, high_contrast_mode, allergies')
            .eq('user_id', user.id)
            .single();

        const { data: memories } = await supabase
            .from('ai_memory')
            .select('memory_type, content')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10);

        userContextStr += "\n-- USER PREFERENCES --\n";
        if (prefs) {
            userContextStr += `Speech Rate: ${prefs.speech_rate}\n`;
            if (prefs.allergies?.length > 0) {
                userContextStr += `CRITICAL ALLERGIES: ${prefs.allergies.join(', ')}\n`;
            }
        }
        userContextStr += "\n-- AI MEMORY --\n";
        if (memories?.length > 0) {
            memories.forEach(m => userContextStr += `[${m.memory_type}]: ${m.content}\n`);
        }
    } catch (e) {
        console.error("Context fetch failed:", e);
    }

    // ── Initialize Multimodal Live Session via SDK ──
    let session = null;
    let hasSentSetup = false;

    ws.on('message', async (data, isBinary) => {
        try {
            if (isBinary) {
                if (session) {
                    session.sendRealtimeInput({
                        audio: data
                    });
                }
                return;
            }

            const msg = JSON.parse(data.toString());

            // Handle Setup Interception
            // The SDK might send 'setup' as the first message
            if (msg.setup && !hasSentSetup) {
                console.log('Intercepting SDK Setup for Context Injection...');
                
                const baseInstructions = msg.setup.systemInstruction?.parts?.[0]?.text || "";
                const finalInstructions = `${baseInstructions}\n\n${userContextStr}`;

                // Extract model ID (ensure it includes the full resource path for Vertex)
                let modelId = msg.setup.model || 'gemini-2.0-flash-live-preview-01-21';
                if (!modelId.includes('/')) {
                    modelId = `projects/${project}/locations/${location}/publishers/google/models/${modelId}`;
                }

                try {
                    session = await ai.live.connect({
                        model: modelId,
                        config: {
                            systemInstruction: {
                                parts: [{ text: finalInstructions }]
                            },
                            generationConfig: msg.setup.generationConfig,
                            tools: msg.setup.tools,
                            responseModalities: msg.setup.generationConfig?.responseModalities || ["audio"]
                        },
                        callbacks: {
                            onopen: () => {
                                console.log('SDK Proxy: Upstream Connected');
                                if (ws.readyState === WebSocket.OPEN) {
                                    // Mirror the SDK's setupComplete message
                                    ws.send(JSON.stringify({ setupComplete: {} }));
                                }
                            },
                            onmessage: (serverMsg) => {
                                if (ws.readyState === ws.OPEN) {
                                    ws.send(JSON.stringify(serverMsg));
                                }
                            },
                            onerror: (err) => {
                                console.error('SDK Proxy: Upstream Error', err);
                                if (ws.readyState === ws.OPEN) {
                                    ws.send(JSON.stringify({ error: err.message || 'Upstream connection error' }));
                                }
                            },
                            onclose: () => {
                                console.log('SDK Proxy: Upstream Closed');
                                ws.close();
                            }
                        }
                    });
                    hasSentSetup = true;
                } catch (connErr) {
                    console.error('SDK Proxy: Connection failed', connErr);
                    ws.close(1011, 'Upstream connection failed');
                }
                return;
            }

            // Route standard client content to the active session
            if (session) {
                if (msg.clientContent) {
                    session.sendClientContent(msg.clientContent);
                } else if (msg.realtimeInput) {
                    session.sendRealtimeInput(msg.realtimeInput);
                } else if (msg.toolResponse) {
                    session.sendToolResponse(msg.toolResponse);
                }
            }

        } catch (e) {
            console.error('SDK Proxy: Message dispatch error:', e);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (session) session.close();
    });

    ws.on('error', (err) => {
        console.error('Client socket error:', err);
        if (session) session.close();
    });
});

ent is alive
    });
});
