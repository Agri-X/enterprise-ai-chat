const express = require('express');
const { v4 } = require('uuid');
const { GoogleGenAI: GoogleAI } = require('@google/genai');
const { FileContext } = require('librechat-data-provider');
const { logger } = require('@librechat/data-schemas');
const { createFile } = require('~/models/File');
const { requireJwtAuth, configMiddleware } = require('~/server/middleware');
const { getBufferMetadata } = require('~/server/utils');
const { getFileStrategy } = require('~/server/utils/getFileStrategy');
const { getStrategyFunctions } = require('~/server/services/Files/strategies');
const { spendTokens } = require('~/models/spendTokens');
const { countTokens } = require('~/server/utils/countTokens');

const router = express.Router();
router.use(requireJwtAuth);

const getApiKey = () =>
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GENAI_API_KEY ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  '';

const IMAGE_BASE_PATH = 'images';

const extractBase64Payload = (data) => {
  if (typeof data !== 'string') {
    return null;
  }

  const trimmed = data.trim();
  if (trimmed.startsWith('data:')) {
    const commaIndex = trimmed.indexOf(',');
    return commaIndex !== -1 ? trimmed.slice(commaIndex + 1) : null;
  }

  return trimmed;
};

const saveBase64Image = async ({ req, data, mimeType }) => {
  const payload = extractBase64Payload(data);
  if (!payload) {
    throw new Error('Invalid image payload returned from Gemini.');
  }

  const buffer = Buffer.from(payload, 'base64');
  const fileId = v4();
  const userId = req.user.id;
  const appConfig = req.config;
  const fileStrategy = getFileStrategy(appConfig, {
    isImage: true,
    context: FileContext.image_generation,
  });
  const { saveBuffer, getFileURL } = getStrategyFunctions(fileStrategy);

  if (!saveBuffer || !getFileURL) {
    throw new Error(`File strategy "${fileStrategy}" does not support image storage.`);
  }

  const {
    bytes = buffer.length,
    type,
    dimensions = {},
    extension: detectedExtension,
  } = (await getBufferMetadata(buffer)) || {};

  const resolvedMimeType = mimeType || type || 'image/png';
  const fallbackExtension = (resolvedMimeType.split('/')[1] || 'png').split(';')[0];
  const extension =
    detectedExtension && detectedExtension !== 'unknown' ? detectedExtension : fallbackExtension;
  const safeExtension = (extension || 'png').toLowerCase();
  const fileName = `img-${fileId}.${safeExtension}`;

  await saveBuffer({ userId, fileName, buffer, basePath: IMAGE_BASE_PATH });
  const filepath = await getFileURL({ userId, fileName, basePath: IMAGE_BASE_PATH });

  await createFile(
    {
      user: userId,
      file_id: fileId,
      bytes,
      filepath,
      filename: fileName,
      source: fileStrategy,
      context: FileContext.image_generation,
      type: resolvedMimeType,
      width: dimensions.width,
      height: dimensions.height,
    },
    true,
  );

  return filepath;
};

router.post('/generate', configMiddleware, async (req, res) => {
  const apiKey = getApiKey();
  const { prompt } = req.body ?? {};

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key is not configured.' });
  }

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'A prompt is required to generate an image.' });
  }
  const mappedModel = 'gemini-2.5-flash-image';

  try {
    if (!GoogleAI) {
      logger.error('[images/generate] GoogleGenerativeAI client is unavailable.');
      return res.status(500).json({ error: 'Image generation client is not available.' });
    }

    const ai = new GoogleAI({ apiKey });
    const response = await ai.models.generateContent({
      model: mappedModel,
      contents: prompt,
    });
    const parts = response?.candidates?.[0]?.content?.parts ?? [];

    const imagePart = parts.find((part) => part?.inlineData || part?.inline_data);

    const inlineData = imagePart?.inlineData || imagePart?.inline_data;
    const data = inlineData?.data;
    const mimeType = inlineData?.mimeType || inlineData?.mime_type || 'image/png';

    if (!data) {
      logger.error('[images/generate] No image returned from Gemini response.');
      return res.status(502).json({ error: 'No image data returned from the model.' });
    }

    const filepath = await saveBase64Image({ req, data, mimeType });

    const usageMetadata = response?.usageMetadata || response?.usage_metadata;
    const promptTokens =
      usageMetadata?.promptTokenCount || usageMetadata?.prompt_token_count || countTokens(prompt);
    const completionTokens = 1290;

    await spendTokens(
      {
        user: req.user.id,
        model: mappedModel,
        context: 'image_generation',
      },
      {
        promptTokens,
        completionTokens,
      },
    );

    return res.status(200).json({
      filepath,
      mimeType,
      model: mappedModel,
    });
  } catch (error) {
    const reason =
      error?.response?.data?.error?.message ||
      error?.message ||
      'Error generating image';
    logger.error('[images/generate] Error generating image', error);
    return res.status(500).json({ error: reason });
  }
});

module.exports = router;
