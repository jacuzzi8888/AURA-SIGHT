# **PRD: Aura Sight – Aura Sentinel**

## **1. Vision & Purpose**

Aura Sight is an agentic "Visual Proxy" for the visually impaired. It leverages Gemini’s native multimodal capabilities to provide real-time, low-latency spatial awareness, safety monitoring, and social context. The goal is to maximize the user's quality of life and independence through a single, voice-driven, hands-free interface.

## **2. Core Pillars (Aura Sentinel)**

1.  **The Hands-Free Sentinel:** Persistent, voice-triggered monitoring that allows the user to navigate the world without manual interaction. Using a specialized "Watch Mode," Aura remains active and alert, providing continuous environmental feedback.
2.  **The Agentic Director:** Proactive camera orientation coaching. Aura doesn't just describe what it sees; it directs the user (e.g., "Tilt up," "Move back") to ensure the most accurate framing for the task at hand.
3.  **The Interactive Ear:** A "Conditional Hot-Mic" system that detects when Gemini has asked a question and automatically opens the microphone for a response, enabling fluid, natural conversation.
4.  **Safety & Privacy at the Edge:** Real-time hazard detection using local MediaPipe vision models to identify trip hazards and apply privacy masks to people in the frame before video data ever leaves the device.

## **3. User Experience (UX) Design**

*   **Multimodal Nexus:** A single, immersive orb interface that changes state (Idle, Scanning, Listening, Responding) to provide clear visual and haptic feedback.
*   **Active Perception:** The AI proactively instructs the user on how to position the camera for better accuracy.
*   **Voice-First Output:** All feedback is delivered via high-quality, low-latency audio using the Vertex AI Multimodal Live API.

## **4. Competitive Advantage for Hackathon**

*   **Near-Zero Latency:** Under 500ms from vision capture to audio feedback via Multimodal Live API.
*   **Hybrid Intelligence:** Combines local edge vision (MediaPipe) for privacy and safety with cloud-based reasoning (Gemini) for complex scene understanding.
*   **Contextual Memory:** Integrates long-term memory and user preferences directly into the AI's reasoning loop.

## **5. Success Metrics**

*   **Latency:** <500ms from vision capture to audio feedback.
*   **Interaction Friction:** Zero-touch navigation using voice-driven "Watch Mode."
*   **User Stickiness:** Ability to complete complex spatial tasks in under 30 seconds.