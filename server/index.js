import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

dotenv.config();

const app = express();
app.use(cors());

// Basic Health Check for Cloud Run
app.get('/health', (req, res) => {
    res.status(200).send('Aura Proxy is healthy.');
});

const PORT = process.env.PORT || 8080;
let secretClient = null;

/**
 * Retrieves the Gemini API Key from environment or Google Cloud Secret Manager.
 */
async function getApiKey() {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;

    try {
        if (!secretClient) {
            secretClient = new SecretManagerServiceClient();
        }
        const project = process.env.GOOGLE_CLOUD_PROJECT || 'aura-sight';
        const [version] = await secretClient.accessSecretVersion({
            name: `projects/${project}/secrets/GEMINI_API_KEY/versions/latest`,
        });
        return version.payload.data.toString();
    } catch (err) {
        console.warn("Secret Manager access failed (missing ADC or project config). Please set GEMINI_API_KEY in .env for local dev.");
        return null;
    }
}

const server = app.listen(PORT, () => {
    console.log(`Aura Proxy listening on port ${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', async (ws, req) => {
    console.log('New client connection request to Aura Proxy');

    const apiKey = await getApiKey();

    if (!apiKey) {
        console.error('CRITICAL: Gemini API Key is missing. Proxy cannot function.');
        ws.close(1011, 'Internal Server Error: API Key Missing');
        return;
    }

    // The Multimodal Live API endpoint for Gemini
    // Note: v1beta is the active preview standard for BidiGenerateContent as of March 2026.
    const googleUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    const googleWs = new WebSocket(googleUrl);

    // Proxy messages from Google back to the Client
    googleWs.on('message', (data) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    });

    // Proxy messages from the Client to Google
    ws.on('message', (data) => {
        if (googleWs.readyState === WebSocket.OPEN) {
            googleWs.send(data);
        }
    });

    googleWs.on('open', () => {
        console.log('Successfully bridged to Google Multimodal Live API');
    });

    googleWs.on('close', (code, reason) => {
        console.log(`Google connection closed: ${code} - ${reason}`);
        ws.close(code, reason);
    });

    ws.on('close', () => {
        console.log('Client session ended. Terminating Google bridge.');
        googleWs.close();
    });

    googleWs.on('error', (err) => {
        console.error('Google WebSocket error:', err);
        ws.send(JSON.stringify({ error: 'Upstream connection error' }));
    });

    ws.on('error', (err) => {
        console.error('Client WebSocket error:', err);
        googleWs.close();
    });
});
