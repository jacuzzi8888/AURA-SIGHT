/**
 * MediaManager handles the camera and microphone streams, 
 * providing frames and audio chunks for the Gemini Multimodal Live API.
 */
export class MediaManager {
    private stream: MediaStream | null = null;
    private videoElement: HTMLVideoElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private audioContext: AudioContext | null = null;
    private processor: AudioWorkletNode | null = null;
    private onAudioData: ((data: Int16Array) => void) | null = null;

    constructor() {
        this.canvas = document.createElement('canvas');
    }

    /**
     * Initializes the camera and microphone.
     */
    async initialize() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Use back camera on phones
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 15 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000
                }
            });

            // Setup video element for frame capture
            this.videoElement = document.createElement('video');
            this.videoElement.srcObject = this.stream;
            this.videoElement.play();

            return true;
        } catch (err) {
            console.error('Failed to initialize media:', err);
            return false;
        }
    }

    /**
     * Captures the current video frame as a base64 JPEG string.
     */
    captureFrame(): string | null {
        if (!this.videoElement || !this.canvas) return null;

        const ctx = this.canvas.getContext('2d');
        if (!ctx) return null;

        // Set canvas dimensions to match video
        if (this.canvas.width !== this.videoElement.videoWidth) {
            this.canvas.width = this.videoElement.videoWidth;
            this.canvas.height = this.videoElement.videoHeight;
        }

        ctx.drawImage(this.videoElement, 0, 0);
        // Gemini likes low-res JPEGs for speed
        return this.canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
    }

    /**
     * Starts capturing audio and converts it to PCM16 16kHz using AudioWorklet.
     */
    async startAudioCapture(callback: (data: Int16Array) => void) {
        if (!this.stream) return;

        this.onAudioData = callback;
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
            sampleRate: 16000
        });

        // Load the worklet
        await this.audioContext.audioWorklet.addModule('/pcm-processor.worklet.js');

        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.processor = new AudioWorkletNode(this.audioContext, 'pcm-processor');

        source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);

        this.processor.port.onmessage = (e) => {
            const pcm16 = new Int16Array(e.data);
            if (this.onAudioData) this.onAudioData(pcm16);
        };
    }

    /**
     * Stops all streams and capture.
     */
    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        if (this.processor) {
            this.processor.disconnect();
        }
        this.stream = null;
        this.stream = null;
        this.videoElement = null;
    }

    /**
     * Exposes the active MediaStream for the UI to display.
     */
    getStream(): MediaStream | null {
        return this.stream;
    }

    /**
     * Toggles the video track securely without destroying the session.
     */
    toggleVideo(enable: boolean) {
        if (!this.stream) return;
        this.stream.getVideoTracks().forEach(track => {
            track.enabled = enable;
        });
    }
}
