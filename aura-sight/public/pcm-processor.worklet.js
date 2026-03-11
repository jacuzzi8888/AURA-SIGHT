/**
 * PCMProcessorWorklet
 * A high-performance AudioWorklet for converting Float32 browser audio
 * to PCM16 (Int16) for the Gemini Multimodal Live API.
 */
class PCMProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length > 0) {
            const channelData = input[0];
            const pcm16 = new Int16Array(channelData.length);

            for (let i = 0; i < channelData.length; i++) {
                // Clamp and convert to Int16
                const s = Math.max(-1, Math.min(1, channelData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
        }
        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);
