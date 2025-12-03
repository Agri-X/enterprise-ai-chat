require('dotenv').config();
const path = require('path');
require('module-alias')({ base: path.resolve(__dirname, 'api') });
const loadCustomConfig = require('./api/server/services/Config/loadCustomConfig');

async function validate() {
    try {
        console.log('Validating librechat.yaml...');
        const config = await loadCustomConfig();
        if (config) {
            console.log('Config is VALID.');
            console.log('File Strategy:', config.fileStrategy);
        } else {
            console.log('Config is INVALID (returned null).');
        }
    } catch (error) {
        console.error('Error validating config:', error);
    }
}

validate();
