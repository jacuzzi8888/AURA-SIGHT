import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { WebSocket } from 'ws';

async function testCombination(version, model) {
    const client = new SecretManagerServiceClient();
    const project = process.env.GOOGLE_CLOUD_PROJECT || 'aura-sight';
    const [secretVersion] = await client.accessSecretVersion({
        name: `projects/${project}/secrets/GEMINI_API_KEY/versions/latest`,
    });
    const apiKey = secretVersion.payload.data.toString();

    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${version}.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    return new Promise((resolve) => {
        console.log(`Testing: ${version} + ${model}...`);
        const ws = new WebSocket(url);

        const timeout = setTimeout(() => {
            console.log(`  [TIMEOUT] ${version} + ${model}`);
            ws.terminate();
            resolve(false);
        }, 5000);

        ws.on('open', () => {
            const setup = {
                setup: { model: `models/${model}` }
            };
            ws.send(JSON.stringify(setup));
        });

        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.setupComplete) {
                console.log(`  [SUCCESS] ${version} + ${model}`);
                clearTimeout(timeout);
                ws.terminate();
                resolve(true);
            }
        });

        ws.on('error', (err) => {
            // Error handling handled by close
        });

        ws.on('close', (code, reason) => {
            if (code !== 1000 && code !== 1001) {
                console.log(`  [FAILED] ${version} + ${model} - Code: ${code}, Reason: ${reason}`);
            }
            clearTimeout(timeout);
            resolve(false);
        });
    });
}

async function run() {
    const versions = ['v1alpha', 'v1beta'];
    const models = [
        'gemini-2.0-flash-exp',
        'gemini-2.5-flash-live',
        'gemini-2.5-flash-live-preview',
        'gemini-live-2.5-flash-native-audio',
        'gemini-3.1-flash-lite-preview'
    ];

    for (const v of versions) {
        for (const m of models) {
            const success = await testCombination(v, m);
            if (success) {
                console.log(`\nFOUND WORKING COMBINATION: ${v} + ${m}\n`);
            }
        }
    }
}

run();
