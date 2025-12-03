const { logger } = require('@librechat/data-schemas');
const { EModelEndpoint } = require('librechat-data-provider');
const {
  getAnthropicModels,
  getBedrockModels,
  getOpenAIModels,
  getGoogleModels,
} = require('~/server/services/ModelService');
const { getAppConfig } = require('./app');

/**
 * Loads the default models for the application.
 * @async
 * @function
 * @param {ServerRequest} req - The Express request object.
 */
async function loadDefaultModels(req) {
  try {
    const appConfig = req.config ?? (await getAppConfig({ role: req.user?.role, refresh: false }));

    // Helper to check if fetch is disabled for an endpoint
    const shouldFetch = (endpoint) => {
      const endpointConfig = appConfig?.endpoints?.[endpoint];
      // If no config or no models config, default to fetching
      if (!endpointConfig?.models) return true;
      // If fetch is explicitly set to false, don't fetch
      return endpointConfig.models.fetch !== false;
    };

    // Helper to get default models from config
    const getDefaultModels = (endpoint) => {
      const endpointConfig = appConfig?.endpoints?.[endpoint];
      return endpointConfig?.models?.default || [];
    };

    const [openAI, anthropic, azureOpenAI, assistants, azureAssistants, google, bedrock] =
      await Promise.all([
        // OpenAI
        shouldFetch(EModelEndpoint.openAI)
          ? getOpenAIModels({ user: req.user.id }).catch((error) => {
            logger.error('Error fetching OpenAI models:', error);
            return getDefaultModels(EModelEndpoint.openAI);
          })
          : Promise.resolve(getDefaultModels(EModelEndpoint.openAI)),

        // Anthropic
        shouldFetch(EModelEndpoint.anthropic)
          ? getAnthropicModels({ user: req.user.id }).catch((error) => {
            logger.error('Error fetching Anthropic models:', error);
            return getDefaultModels(EModelEndpoint.anthropic);
          })
          : Promise.resolve(getDefaultModels(EModelEndpoint.anthropic)),

        // Azure OpenAI
        shouldFetch(EModelEndpoint.azureOpenAI)
          ? getOpenAIModels({ user: req.user.id, azure: true }).catch((error) => {
            logger.error('Error fetching Azure OpenAI models:', error);
            return [];
          })
          : Promise.resolve([]),

        // Assistants
        getOpenAIModels({ assistants: true }).catch((error) => {
          logger.error('Error fetching OpenAI Assistants API models:', error);
          return [];
        }),

        // Azure Assistants
        getOpenAIModels({ azureAssistants: true }).catch((error) => {
          logger.error('Error fetching Azure OpenAI Assistants API models:', error);
          return [];
        }),

        // Google
        shouldFetch(EModelEndpoint.google)
          ? Promise.resolve(getGoogleModels()).catch((error) => {
            logger.error('Error getting Google models:', error);
            return getDefaultModels(EModelEndpoint.google);
          })
          : Promise.resolve(getDefaultModels(EModelEndpoint.google)),

        // Bedrock
        Promise.resolve(getBedrockModels()).catch((error) => {
          logger.error('Error getting Bedrock models:', error);
          return [];
        }),
      ]);

    return {
      [EModelEndpoint.openAI]: openAI,
      [EModelEndpoint.google]: google,
      [EModelEndpoint.anthropic]: anthropic,
      [EModelEndpoint.azureOpenAI]: azureOpenAI,
      [EModelEndpoint.assistants]: assistants,
      [EModelEndpoint.azureAssistants]: azureAssistants,
      [EModelEndpoint.bedrock]: bedrock,
    };
  } catch (error) {
    logger.error('Error fetching default models:', error);
    throw new Error(`Failed to load default models: ${error.message}`);
  }
}

module.exports = loadDefaultModels;

