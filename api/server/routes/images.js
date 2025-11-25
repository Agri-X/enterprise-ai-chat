const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');

const { GoogleGenAI: GoogleAI } = require('@google/genai');

const router = express.Router();
router.use(requireJwtAuth);

const getApiKey = () =>
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GENAI_API_KEY ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  '';

router.post('/generate', async (req, res) => {
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
