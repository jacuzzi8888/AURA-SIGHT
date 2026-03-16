# **PRD: Aura Sight – One-Shot Direct Intent**

## **1. Vision & Purpose**

Aura Sight is an agentic "Visual Proxy" for the visually impaired. It leverages Gemini’s native multimodal capabilities to provide real-time, low-latency spatial awareness, safety monitoring, and social context. The goal is to maximize the user's quality of life and independence through a single, clean, user-driven interface.

## **2. Core Pillars (Direct Intent Model)**

1.  **The Direct Intent Sentinel:** A single-turn "Capture & Process" model. Triggered by a long-press, the app records the environment silently. Only upon a subsequent "Tap" does processing begin, ensuring the AI only speaks when explicitly summoned.
2.  **The Agentic Director:** Proactive camera orientation coaching provided during the active response phase or as part of the task identification.
3.  **Strict Resource Lockdown:** Sensors (camera and microphone) are activated only during the user-initiated recording window and killed instantly after the AI's response is delivered.
4.  **Privacy at the Source:** Real-time hazard detection using local MediaPipe vision models to identify trip hazards and apply privacy masks to people in the frame before video data ever leaves the device.

## **3. User Experience (UX) Design**

*   **Multimodal Nexus:** A single, immersive orb interface that changes state (Idle, Recording, Thinking, Responding) to provide clear visual and haptic feedback.
*   **Active Perception:** The AI proactively instructs the user on how to position the camera for better accuracy.
*   **Voice-First Output:** All feedback is delivered via high-quality, low-latency audio using the Vertex AI Multimodal Live API.

## **4. Competitive Advantage for Hackathon**

*   **Near-Zero Latency:** Under 500ms from vision capture to audio feedback via Multimodal Live API.
*   **Hybrid Intelligence:** Combines local edge vision (MediaPipe) for privacy and safety with cloud-based reasoning (Gemini) for complex scene understanding.
*   **Contextual Memory:** Integrates long-term memory and user preferences directly into the AI's reasoning loop.

## **5. Success Metrics**

*   **Latency:** <500ms from vision capture to audio feedback.
*   **Interaction Friction:** Single-turn, manual trigger reduces noise and improves reliability.
*   **Privacy Compliance:** Zero data collection while the app is in the idle state.