# **Context: Aura Sight Technical Architecture**

## 1. 2026 Alignment
*   **Audio Engine**: `AudioWorklet` (pcm-processor.worklet.js) optimized for 40ms chunks + `AudioPlayer.ts` (24kHz PCM16).
*   **Interaction Logic**: Isolated Push-to-Talk Perimeter. The WebSocket disconnects after every turn to ensure privacy and silence.
*   **Session Stability**: Full `sessionResumption` support. Context is preserved across disconnects/reconnects.
*   **Backend**: Node.js/Express WebSocket Proxy on Cloud Run (No CPU Throttling, Min 1 Instance).

## 2. Aura Sentinel Interaction Flow

1.  **Hold-to-Talk**: User long-presses the Nexus ring.
    *   `Earcon: start` chime plays.
    *   WebSocket connects (resuming previous context if available).
2.  **Multimodal Stream**: Real-time 24kHz audio and 1 FPS video frames are streamed.
3.  **Release-to-Process**: User releases the ring.
    *   `turnComplete` signal triggers Gemini's response.
4.  **Aura Response**: Gemini streams audio back with low latency.
5.  **Turn Complete**: Gemini signals turn completion.
    *   WebSocket disconnects.
    *   Media tracks are stopped.
    *   App returns to idle.

## 4. Current State (Production Stable)

*   ✅ **High Fidelity Audio**: Fixed sample rate mismatch (16kHz -> 24kHz).
*   ✅ **Unlimited Session Duration**: Context compression and resumption implemented.
*   ✅ **Hands-Free Mode**: Implemented voice-activated persistent monitoring ("Aura, watch this").
*   ✅ **Stable Connection**: Resolved 1007 JSON handshake error.
*   ✅ **Immersive UI**: Added high-contrast scanning visuals for watch mode.
*   🕒 **Interactive Ear (Planned)**: Conditional Hot-Mic with 10s auto-timeout and "Amber" state for AI questions.