// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/generate', async (req, res) => {
  const { prompt, size, lang } = req.body;

  if (!prompt) {
    return res.json({
      code:
        '<h2 style="color:red; text-align:center;">Error: Prompt is missing</h2>',
    });
  }

  // Map user size choice ("512x512" vs. "1024x1024") to actual API calls
  // - Fast (512x512) → use DALL·E‐2 at 256×256
  // - Detailed (1024×1024) → use DALL·E‐3 at 1024×1024
  let imageModel, imageSize;

  if (size === '512x512') {
    // Use DALL·E‐2 at 256×256 for a faster, smaller image
    imageModel = 'dall-e-2';
    imageSize = '256x256';
  } else {
    // Default to DALL·E‐3 at 1024×1024 for detailed images
    imageModel = 'dall-e-3';
    imageSize = '1024x1024';
  }

  // Build language instruction if needed:
  // Only prepend "Respond in X" if lang is not English
  const languageNames = { he: 'Hebrew', es: 'Spanish', fr: 'French' };
  const fullLang = languageNames[lang] || (lang === 'en' ? 'English' : null);
  const languageInstruction =
    fullLang && fullLang !== 'English'
      ? `Respond in ${fullLang}. `
      : '';

  try {
    // STEP 1: Generate an image with the appropriate model/size
    const imageResponse = await openai.images.generate({
      model: imageModel,
      prompt: prompt,
      n: 1,
      size: imageSize,
    });

    const imageUrl = imageResponse.data[0].url;

    // STEP 2: Escape the prompt for safe HTML insertion
    const escapedPrompt = prompt
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // STEP 3: Build a kid-friendly HTML snippet that wraps the image
    // We keep the same styling and animation we had before
    // NOTE: We inject a comment <!-- Respond in X --> if a non-English lang was requested
    const html =
      '<!-- ' +
      languageInstruction +
      '-->' +
      '<div style="font-family:\'Comic Neue\', sans-serif; ' +
      'background:#e0f7fa; color:#004d40; text-align:center; padding:1rem;">' +
      '<h2 style="color:#00796b; margin-bottom:0.5rem;">Your AI Creation</h2>' +
      // We display the image at up to 80% width; if it was 256×256, it’ll scale up nicely
      '<img src="' +
      imageUrl +
      '" alt="AI-Generated Image" ' +
      'style="max-width:80%; height:auto; border:5px solid #004d40; ' +
      'border-radius:10px; box-shadow:0 0 10px rgba(0,0,0,0.2); ' +
      'animation: zoomIn 1s ease-in-out;">' +
      '<p style="margin-top:0.5rem; font-size:1rem;">Prompt: “<em>' +
      escapedPrompt +
      '</em>”</p>' +
      '<style>' +
      '@keyframes zoomIn {' +
      'from { transform: scale(0.8); opacity: 0.5; } ' +
      'to { transform: scale(1); opacity: 1; } ' +
      '}' +
      '</style>' +
      '</div>';

    return res.json({ code: html });
  } catch (error) {
    console.error('Image generation error:', error);

    const errMsg =
      (error.response &&
        error.response.data &&
        error.response.data.error &&
        error.response.data.error.message) ||
      error.message ||
      'Unknown error';

    return res.json({
      code:
        '<div style="font-family:sans-serif; color:red; text-align:center; padding:2rem;">' +
        '<h2>Error generating image</h2>' +
        '<pre style="white-space:pre-wrap;">' +
        errMsg +
        '</pre>' +
        '</div>',
    });
  }
});

app.listen(port, () => {
  console.log('Server running on port ' + port);
});


app.listen(port, () => {
  console.log('Server running on port ' + port);
});

