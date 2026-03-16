# Aura Sight – The Agentic Visual Proxy

> **Elevator Pitch**: Aura Sight is a proactive sensory extension for the visually impaired. Using Gemini Live 2.5 Flash, it provides a clean, single-turn interaction model for real-time spatial coaching and identification.

---

## 🌟 Vision & Inspiration
Specialized assistive hardware for the blind is often prohibitively expensive. **Aura Sight** democratizes access to spatial independence by turning the smartphone into a professional-grade "Visual Proxy." Built by a solo developer, it bridges the gap between passive description and active guidance.

## 🛡️ One-Shot Direct Intent Pillars
1. **One-Shot Direct Intent**: A clean, single-turn interaction flow (Long-Press to Start -> Tap to Process).
2. **Agentic Director**: Proactive camera orientation coaching for precise visual alignment.
3. **Zero-Session Leakage**: Camera and microphone are physically killed instantly after every response.
4. **Safety & Privacy at the Edge**: Local MediaPipe models redact faces and detect hazards at the source.

## 🏗️ Technical Architecture (Edge-Cloud Hybrid)
Aura Sight leverages a high-performance loop designed for under 500ms latency:
- **Edge**: MediaPipe redacts personal identifiers and detects immediate trip hazards.
- **Backend (Node.js)**: A secure WebSocket proxy handles JWT authentication and context injection.
- **Cloud Intelligence (Vertex AI)**: Gemini Live 2.5 Flash handles complex multimodal reasoning and spatial description.
- **Memory (Supabase)**: Persistent storage for user preferences and long-term AI memory.

## 🛠️ Built With
- **AI**: Gemini Live 2.5 Flash (Multimodal Live API)
- **Infrastructure**: Google Cloud Vertex AI, Secret Manager
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Vision**: MediaPipe (Local Edge Inference)
- **Database/Auth**: Supabase
- **Backend**: Node.js, Express, WebSockets (ws)

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- A Google Cloud Project with Vertex AI API enabled
- A Supabase Project

### Installation
1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-repo/aura-sight.git
   cd aura-sight
   ```

2. **Install dependencies**:
   ```bash
   # Root
   npm install
   # Server
   cd server && npm install
   # Frontend
   cd ../aura-sight && npm install
   ```

3. **Environment Setup**:
   Create a `.env` in the `server` directory:
   ```env
   GOOGLE_CLOUD_PROJECT=your-project-id
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-key
   ```

4. **Run the application**:
   ```bash
   # In server/
   npm run dev
   # In aura-sight/
   npm run dev
   ```

## 🛤️ Future Roadmap
- **Wearable Integration**: Porting Aura Sight to smart glasses and specialized "clothes-pin" camera devices.
- **Spatial Audio**: Integrating HRTF-based spatial audio for even more intuitive direction signaling.
- **Indoor Navigation**: Integrating with building BIM data for precise indoor room-to-room guidance.

---
*Built for the Gemini Live Agent Challenge 2026. 100% Solo-Dev Effort.*
