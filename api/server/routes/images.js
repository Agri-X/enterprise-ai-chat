const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');

const { GoogleGenerativeAI: GoogleAI } = require('@google/generative-ai');

const router = express.Router();
router.use(requireJwtAuth);

const MODEL_MAP = {
  'gemini-3-pro-image-preview': 'gemini-3-pro-image-preview',
  'gemini-2.5-flash-image': 'gemini-2.5-flash-image',
};

const getApiKey = () =>
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GENAI_API_KEY ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  '';

router.post('/generate', async (req, res) => {
  const apiKey = getApiKey();
  const { prompt, model } = req.body ?? {};

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key is not configured.' });
  }

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'A prompt is required to generate an image.' });
  }

  const mappedModel = MODEL_MAP[model] || model;
  if (!mappedModel || typeof mappedModel !== 'string') {
    return res.status(400).json({ error: 'An image model must be provided.' });
  }

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
    const parts = response?.response?.candidates?.[0]?.content?.parts ?? [];

    const imagePart =
      parts.find((part) => part?.inlineData || part?.inline_data) ||
      response?.response?.candidates?.[0]?.content?.parts?.find(
        (part) => part?.inlineData || part?.inline_data,
      );

    const inlineData = imagePart?.inlineData || imagePart?.inline_data;
    const data = inlineData?.data;
    const mimeType = inlineData?.mimeType || inlineData?.mime_type || 'image/png';

    if (!data) {
      logger.error('[images/generate] No image returned from Gemini response.');
      return res.status(502).json({ error: 'No image data returned from the model.' });
    }

    return res.status(200).json({
      image: data,
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
