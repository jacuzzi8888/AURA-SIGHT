# **Context: Technical Stack & Implementation Guide**

## **1\. Technical Stack**

* **AI Model:** gemini-2.5-flash-preview-09-2025 (Optimized for vision-to-speech latency).  
* **Communication:** WebSockets via the **Multimodal Live API**.  
* **Frontend:** React \+ Tailwind CSS (Mobile-responsive PWA).  
* **Deployment:** Vercel (Frontend) \+ Google Cloud Functions/Run (for any stateful backend needs).

## **2\. API Interaction Flow**

1. **Media Access:** App requests getUserMedia for both audio and video.  
2. **Stream Setup:** Open a WebSocket connection to wss://generativelanguage.googleapis.com/....  
3. **Continuous Feed:** Send 15-30 frames per second (vision) \+ PCM16 audio (speech) to Gemini.  
4. **Model Response:** Gemini sends back PCM16 audio which is played through the user's headphones immediately.

## **3\. Hardware Roadmap (Pitch Content)**

* **Current MVP:** Mobile Phone (Hand-held or Chest-pocket).  
* **Phase 2 (Post-Hackathon):** Bluetooth integration with **UVC-compatible camera glasses**. These glasses act as a standard camera peripheral for the mobile device, allowing Aura to see exactly what the user sees from eye level.

## **4\. Key Implementation Challenges**

* **Token Management:** Ensuring the "Pathfinder" mode is efficient to stay within free-tier limits.  
* **Framing Logic:** Calibrating the "Director" instructions to be intuitive for someone who cannot see the screen.