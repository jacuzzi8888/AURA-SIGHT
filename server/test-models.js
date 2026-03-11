import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

async function listModels(version = 'v1beta') {
    try {
        const client = new SecretManagerServiceClient();
        const project = process.env.GOOGLE_CLOUD_PROJECT || 'aura-sight';
        const [secretVersion] = await client.accessSecretVersion({
            name: `projects/${project}/secrets/GEMINI_API_KEY/versions/latest`,
        });
        const apiKey = secretVersion.payload.data.toString();

        console.log(`--- Available Models (${version}) ---`);
        const response = await fetch(`https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`);
        const data = await response.json();

        if (data.models) {
            data.models.forEach(m => {
                const methods = m.supportedGenerationMethods || [];
                if (methods.includes('bidiGenerateContent')) {
                    console.log(`[LIVE] ${m.name}`);
                } else {
                    console.log(`[STDR] ${m.name}`);
                }
            });
        } else {
            console.log(`No models found for ${version}:`, data);
        }
    } catch (err) {
        console.error(`Error listing models for ${version}:`, err.message);
    }
}

async function run() {
    await listModels('v1beta');
    await listModels('v1beta1');
}

run();
