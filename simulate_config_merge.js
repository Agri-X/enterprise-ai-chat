const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

// 1. Load the user's librechat.yaml
const configPath = path.join(__dirname, 'librechat.yaml');
const fileContents = fs.readFileSync(configPath, 'utf8');
const appConfig = yaml.load(fileContents);

console.log('--- Loaded librechat.yaml ---');
console.log('OpenAI Config in YAML:', JSON.stringify(appConfig.endpoints.openAI, null, 2));

// 2. Simulate the Default Configuration (from Env Vars)
// This is what the system generates automatically before looking at librechat.yaml
const defaultEndpointsConfig = {
    openAI: {
        apiKey: 'sk-default-from-env',
        models: {
            default: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', '...50 other models...'],
            fetch: true, // Auto-fetch enabled by default
        },
        titleConvo: true,
        // ... other defaults
    },
    // ... other endpoints
};

// 3. Simulate the OLD Logic (Buggy)
// It only merged 'custom', 'assistants', 'bedrock', etc.
const oldMergedConfig = { ...defaultEndpointsConfig };
// (No logic to merge appConfig.endpoints.openAI)

console.log('\n--- OLD Logic Result (Buggy) ---');
console.log('OpenAI Models:', oldMergedConfig.openAI.models);
console.log('Fetch Enabled:', oldMergedConfig.openAI.models.fetch);

// 4. Simulate the NEW Logic (Fixed)
// Explicitly merges openAI, google, anthropic
const newMergedConfig = { ...defaultEndpointsConfig };

if (appConfig.endpoints && appConfig.endpoints.openAI) {
    newMergedConfig.openAI = {
        ...newMergedConfig.openAI,
        ...appConfig.endpoints.openAI,
    };
}

console.log('\n--- NEW Logic Result (Fixed) ---');
console.log('OpenAI Models:', newMergedConfig.openAI.models);
console.log('Fetch Enabled:', newMergedConfig.openAI.models.fetch);

console.log('\n--- Verification ---');
if (newMergedConfig.openAI.models.fetch === false) {
    console.log('SUCCESS: Fetch is correctly disabled.');
} else {
    console.log('FAILURE: Fetch is still enabled.');
}
