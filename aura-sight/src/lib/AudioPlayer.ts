/**
 * AudioPlayer handles real-time playback of raw PCM16 16kHz audio 
 * chunks returned by the Gemini Multimodal Live API.
 */
export class AudioPlayer {
    private audioContext: AudioContext | null = null;
    private nextStartTime: number = 0;

    constructor() {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
            sampleRate: 16000
        });
    }

    /**
     * Queues a buffer of raw PCM16 data for playback.
     * @param pcm16Data - Int16Array of audio samples.
     */
    queueAudio(pcm16Data: Int16Array) {
        if (!this.audioContext) return;

        const float32Data = new Float32Array(pcm16Data.length);
        for (let i = 0; i < pcm16Data.length; i++) {
            // Convert Int16 back to Float32 (-1.0 to 1.0)
            float32Data[i] = pcm16Data[i] / 0x8000;
        }

        const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, 16000);
        audioBuffer.copyToChannel(float32Data, 0);

        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);

        // Schedule playback to ensure gapless transition
        const currentTime = this.audioContext.currentTime;
        if (this.nextStartTime < currentTime) {
            this.nextStartTime = currentTime + 0.05; // Small buffer for initial chunk
        }

        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
    }

    /**
     * Resume the audio context (required by browser security).
     */
    async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    /**
     * Stops playback and resets the queue.
     */
    stop() {
        this.nextStartTime = 0;
    }
}
