/**
 * LiveAPIClient handles the WebSocket connection to the Aura Proxy,
 * managing the bidirectional stream of audio/video to Gemini Multimodal Live API.
 */
export class LiveAPIClient {
    private ws: WebSocket | null = null;
    private readonly url: string;
    private onContentHandler: (text: string) => void = () => { };
    private onAudioHandler: (data: Int16Array) => void = () => { };
    private isConnected: boolean = false;

    constructor(url?: string) {
        if (url) {
            this.url = url;
        } else {
            // Use protocol-relative logic for the default URL
            const protocol = API_BASE_URL.includes('localhost') ? 'ws' : 'wss';
            this.url = `${protocol}://${API_BASE_URL}`;
        }
    }

    /**
     * Connects to the proxy and initializes the Gemini session.
     */
    async connect() {
        console.log("LiveAPIClient: Connecting to", this.url);
        return new Promise<void>((resolve, reject) => {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log('LiveAPIClient: Connected to Aura Proxy');
                this.isConnected = true;

                // Initial Setup Message for Gemini
                const setupMessage = {
                    setup: {
                        model: "models/gemini-2.0-flash-exp",
                        generation_config: {
                            response_modalities: ["audio", "text"],
                        },
                        system_instruction: {
                            parts: [{
                                text: `You are Aura Sight, a high-performance multisensory AI for the visually impaired.
Your mission is to provide proactive, intelligent assistance through a single interaction.

CORE BEHAVIORS:
1. LISTEN & OBSERVE: You receive live video and audio. Listen for user intent (e.g., "how do I look?", "is this food safe?", "can I walk here?").
2. ADAPTIVE MISSIONS:
   - PATHFINDER: If the user is moving or asks about their path, provide step-by-step spatial guidance and hazard warnings (e.g., "Step left to avoid the chair").
   - SOCIAL MIRROR: If the user asks about people or surroundings, describe moods, gestures, and social layout.
   - THE GUARDIAN: If the user asks about health/safety (allergens, prescriptions, stove), provide definitive, high-accuracy identification.
   - STYLE GUIDE: If the user asks about an outfit, give honest, dignified fashion advice based on color and fit.
3. TONE: Be professional, dignified, and ultra-concise. Use under 15 words unless a complex description is requested.
4. SAFETY FIRST: Always interrupt any description to warn about immediate physical danger (curbs, moving objects, flames).`
                            }]
                        }
                    }
                };
                this.ws?.send(JSON.stringify(setupMessage));
                resolve();
            };

            this.ws.onmessage = async (event) => {
                const data = JSON.parse(event.data);
                this.handleServerMessage(data);
            };

            this.ws.onclose = (event) => {
                console.log('LiveAPIClient: Disconnected from Aura Proxy', event.code, event.reason);
                this.isConnected = false;
                reject(new Error(`WebSocket closed: ${event.code} ${event.reason}`));
            };

            this.ws.onerror = (err) => {
                console.error('WebSocket Error:', err);
                reject(err);
            };
        });
    }

    /**
     * Handles incoming messages from the Gemini Live API.
     */
    private async handleServerMessage(message: any) {
        // Handle Setup Complete
        if (message.setupComplete) {
            console.log('Gemini Live Session Initialized');
            return;
        }

        // Handle Server Content (Text and Audio)
        if (message.serverContent) {
            const modelTurn = message.serverContent.modelTurn;
            if (modelTurn && modelTurn.parts) {
                for (const part of modelTurn.parts) {
                    if (part.text) {
                        this.onContentHandler(part.text);
                    }
                    if (part.inlineData && part.inlineData.mimeType === 'audio/pcm;rate=16000') {
                        // Convert base64 audio to Int16Array
                        const binaryString = atob(part.inlineData.data);
                        const len = binaryString.length;
                        const bytes = new Uint8Array(len);
                        for (let i = 0; i < len; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        const pcm16 = new Int16Array(bytes.buffer);
                        this.onAudioHandler(pcm16);
                    }
                }
            }
        }

        // Handle Interruption (Barge-in)
        if (message.interrupted) {
            console.log('Gemini interrupted. Clearing local audio queue.');
            // TODO: Signal to AudioPlayer to clear queue
        }
    }

    /**
     * Sends a video frame (base64) to Gemini.
     */
    sendVideoFrame(base64Frame: string) {
        if (!this.isConnected || !this.ws) return;

        const message = {
            realtime_input: {
                media_chunks: [
                    {
                        mime_type: "image/jpeg",
                        data: base64Frame
                    }
                ]
            }
        };
        this.ws.send(JSON.stringify(message));
    }

    /**
     * Sends audio data (PCM16) to Gemini.
     */
    sendAudioChunk(pcm16Data: Int16Array) {
        if (!this.isConnected || !this.ws) return;

        // Convert Int16Array to Base64
        const uint8 = new Uint8Array(pcm16Data.buffer);
        let binary = '';
        const len = uint8.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(uint8[i]);
        }
        const base64Audio = btoa(binary);

        const message = {
            realtime_input: {
                media_chunks: [
                    {
                        mime_type: "audio/pcm;rate=16000",
                        data: base64Audio
                    }
                ]
            }
        };
        this.ws.send(JSON.stringify(message));
    }

    /**
     * Registers a callback for text content updates.
     */
    onContent(handler: (text: string) => void) {
        this.onContentHandler = handler;
    }

    /**
     * Registers a callback for audio data updates.
     */
    onAudio(handler: (data: Int16Array) => void) {
        this.onAudioHandler = handler;
    }

    /**
     * Disconnects the session.
     */
    disconnect() {
        this.ws?.close();
        this.isConnected = false;
    }
}
