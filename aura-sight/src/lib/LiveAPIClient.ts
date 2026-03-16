import { supabase } from './supabase';
import { GoogleGenAI, Modality, Type } from '@google/genai';

const PRODUCTION_PROXY_URL = 'aura-proxy-432140310963.us-central1.run.app';
const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'localhost:8080'
    : PRODUCTION_PROXY_URL;

/**
 * LiveAPIClient handles the bidirectional stream of audio/video to Gemini 
 * using the official @google/genai SDK via the Aura Proxy.
 */
export class LiveAPIClient {
    private session: any | null = null;
    private readonly baseUrl: string;
    private onContentHandler: (text: string) => void = () => { };
    private onAudioHandler: (data: Int16Array) => void = () => { };
    private onDisconnectHandler: (reason: string) => void = () => { };
    private onInterruptedHandler: () => void = () => { };
    private onTurnCompleteHandler: () => void = () => { };
    private onTranscriptionHandler: (text: string) => void = () => { };
    private onReconnectingHandler: (attempt: number) => void = () => { };
    private onReconnectedHandler: () => void = () => { };
    
    public isConnected: boolean = false;
    private messageQueue: any[] = [];

    // Reconnection state
    private reconnectAttempts: number = 0;
    private shouldReconnect: boolean = true;
    private reconnectTimer: number | null = null;

    constructor() {
        const protocol = API_BASE_URL.includes('localhost') ? 'http' : 'https';
        this.baseUrl = `${protocol}://${API_BASE_URL}`;
    }

    /**
     * Connects to the proxy and initializes the Gemini session using the SDK.
     */
    async connect(jwtToken?: string) {
        if (!jwtToken) {
            const { data: { session } } = await supabase.auth.getSession();
            jwtToken = session?.access_token;
        }

        console.log("LiveAPIClient: Initializing SDK with base URL:", this.baseUrl);
        
        const ai = new GoogleGenAI({
            apiKey: jwtToken || 'no-token', // Our proxy uses this as the JWT
            // Note: In Vertex AI mode with a proxy, we use the SDK's ability to override base URL
            httpOptions: {
                baseUrl: this.baseUrl
            }
        });

        const modelId = "gemini-3-flash";

        try {
            this.session = await ai.live.connect({
                model: modelId,
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: {
                        parts: [{
                            text: `You are Aura Sight, a frontier-class multisensory AI companion for the visually impaired.
ONE-SHOT DIRECT INTENT PROTOCOL:
1. You only respond when explicitly summoned via a Turn Completion signal. Do NOT narrate in the background.
2. Focus on answering the specific user queries posed during the user's recorded window.
3. Proactively provide camera orientation coaching ("Director" persona) during your response if the visual context was unclear.
4. Keep responses professional, concise, and minimalist.`
                        }]
                    },
                    tools: [
                        {
                            functionDeclarations: [
                                {
                                    name: "add_allergy",
                                    description: "Adds a new allergy to the user's profile.",
                                    parameters: {
                                        type: Type.OBJECT,
                                        properties: { allergy: { type: Type.STRING } },
                                        required: ["allergy"]
                                    }
                                },
                                {
                                    name: "save_fact",
                                    description: "Saves a general fact about the user.",
                                    parameters: {
                                        type: Type.OBJECT,
                                        properties: { fact: { type: Type.STRING } },
                                        required: ["fact"]
                                    }
                                }
                            ]
                        }
                    ]
                },
                callbacks: {
                    onopen: () => {
                        console.log('LiveAPIClient: SDK Session Connected');
                        this.isConnected = true;
                        this.reconnectAttempts = 0;
                        this.flushMessageQueue();
                    },
                    onmessage: (msg: any) => {
                        this.handleServerMessage(msg);
                    },
                    onclose: (event: any) => {
                        console.log("LiveAPIClient: SDK Session Closed", event);
                        this.isConnected = false;
                        this.onDisconnectHandler(event.reason || "Connection closed");
                        
                        // Error 1007: Invalid resource field value (Logical error, stop reconnecting)
                        if (event.code === 1007) {
                            console.error("LiveAPIClient: Critical 1007 error. Stopping reconnection.");
                            this.shouldReconnect = false;
                        }

                        if (this.shouldReconnect && this.reconnectAttempts < 5) {
                            this.attemptReconnect();
                        }
                    },
                    onerror: (err: any) => {
                        console.error('LiveAPIClient: SDK Session Error', err);
                    }
                }
            });
        } catch (err) {
            console.error("LiveAPIClient: SDK Connection failed", err);
            throw err;
        }
    }

    private async attemptReconnect() {
        if (this.reconnectAttempts >= 15) {
            this.onDisconnectHandler('Max reconnection attempts reached');
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts));
        console.log(`LiveAPIClient: Reconnecting in ${delay}ms...`);
        this.onReconnectingHandler(this.reconnectAttempts);
        
        await new Promise<void>(resolve => {
            this.reconnectTimer = window.setTimeout(() => {
                this.reconnectTimer = null;
                resolve();
            }, delay);
        });

        if (!this.shouldReconnect) return;
        try {
            await this.connect();
            this.onReconnectedHandler();
        } catch (e) {
            // Re-attempting is handled by connect's own error or next onclose
        }
    }

    private handleServerMessage(message: any) {
        // Interruption
        if (message.serverContent?.interrupted) {
            this.onInterruptedHandler();
            return;
        }

        // Content & Audio
        const modelTurn = message.serverContent?.modelTurn;
        if (modelTurn?.parts) {
            for (const part of modelTurn.parts) {
                if (part.text) this.onContentHandler(part.text);
                
                if (part.inlineData && part.inlineData.mimeType.startsWith('audio')) {
                    const binaryString = atob(part.inlineData.data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    this.onAudioHandler(new Int16Array(bytes.buffer));
                }

                if (part.functionCall) {
                    this.executeFunctionCall(part.functionCall);
                }
            }
        }

        // Top-level Tool Call (SDK specific relay)
        if (message.toolCall?.functionCalls) {
            for (const fc of message.toolCall.functionCalls) {
                this.executeFunctionCall(fc);
            }
        }

        // Transcription
        const transcript = message.serverContent?.inputTranscription?.text || message.transcription?.text;
        if (transcript) {
            this.onTranscriptionHandler(transcript);
        }

        // Turn complete
        if (message.serverContent?.turnComplete) {
            this.onTurnCompleteHandler();
        }
    }

    private async executeFunctionCall(fc: any) {
        const { name, args, id } = fc;
        console.log(`Tool Call: ${name}`, args);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            if (name === 'add_allergy') {
                await supabase.from('ai_memory').insert({ 
                    user_id: user.id, 
                    content: `Allergy: ${args.allergy}`, 
                    category: 'allergy' 
                });
                this.sendToolResponse(name, id, { result: 'Saved' });
            } else if (name === 'save_fact') {
                await supabase.from('ai_memory').insert({ 
                    user_id: user.id, 
                    content: args.fact, 
                    category: 'fact' 
                });
                this.sendToolResponse(name, id, { result: 'Saved' });
            }
        } catch (e) {
            console.error("Tool execution error", e);
        }
    }

    sendVideoFrame(base64Frame: string) {
        if (!this.session || !this.isConnected) return;
        try {
            this.session.sendRealtimeInput({
                mediaChunks: [{
                    mimeType: "image/jpeg",
                    data: base64Frame
                }]
            });
        } catch (e) {
            console.debug("LiveAPIClient: Failed to send video frame (socket closed)");
        }
    }

    sendAudioChunk(pcm16Data: Int16Array) {
        if (!this.session || !this.isConnected) return;
        try {
            const uint8 = new Uint8Array(pcm16Data.buffer);
            let binary = '';
            for (let i = 0; i < uint8.byteLength; i++) {
                binary += String.fromCharCode(uint8[i]);
            }
            this.session.sendRealtimeInput({
                mediaChunks: [{
                    mimeType: "audio/pcm;rate=16000",
                    data: btoa(binary)
                }]
            });
        } catch (e) {
            console.debug("LiveAPIClient: Failed to send audio chunk (socket closed)");
        }
    }

    sendTurnComplete() {
        if (!this.session || !this.isConnected) return;
        this.session.sendClientContent({ turnComplete: true });
    }

    private sendToolResponse(name: string, id: string, response: any) {
        if (!this.session || !this.isConnected) return;
        this.session.sendToolResponse({
            functionResponses: [{ name, id, response }]
        });
    }

    private flushMessageQueue() {
        while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            // In SDK mode, we call session methods
            if (msg.realtimeInput) this.session.sendRealtimeInput(msg.realtimeInput);
            if (msg.clientContent) this.session.sendClientContent(msg.clientContent);
        }
    }

    disconnect() {
        this.shouldReconnect = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.session) this.session.close();
        this.isConnected = false;
    }

    // Event registrations (keep same for API compatibility)
    onContent(h: (text: string) => void) { this.onContentHandler = h; }
    onAudio(h: (data: Int16Array) => void) { this.onAudioHandler = h; }
    onDisconnect(h: (reason: string) => void) { this.onDisconnectHandler = h; }
    onInterrupted(h: () => void) { this.onInterruptedHandler = h; }
    onTurnComplete(h: () => void) { this.onTurnCompleteHandler = h; }
    onTranscription(h: (text: string) => void) { this.onTranscriptionHandler = h; }
    onReconnecting(h: (attempt: number) => void) { this.onReconnectingHandler = h; }
    onReconnected(h: () => void) { this.onReconnectedHandler = h; }
}
