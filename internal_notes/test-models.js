import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';

async function listModels() {
    const auth = new GoogleAuth({
        scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    const projectId = 'ocellus-488718';
    const location = 'us-central1';
    
    // REST API Endpoint to list publishers/google models
    const url = `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/google/models`;
    
    console.log("Fetching: " + url);
    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token.token}`
        }
    });

    const data = await res.json();
    if (data.models) {
        const liveModels = data.models.filter(m => m.name.includes('live') || m.name.includes('bidi') || m.name.includes('gemini'));
        console.log("Gemini / Live Models Found:");
        liveModels.forEach(m => console.log(m.name.split('publishers/google/models/')[1]));
    } else {
        console.log("No models array returned:", data);
    }
}

listModels().catch(console.error);
