const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post('/generate', async (req, res) => {
  const { prompt, size } = req.body;
  if (!prompt) {
    return res.json({
      code:
        '<h2 style="color:red; text-align:center;">Error: Prompt is missing</h2>'
    });
  }

  // Default to 512x512 if size is not exactly "1024x1024"
  const imageSize = size === '1024x1024' ? '1024x1024' : '512x512';

  try {
    // 1) Generate image via DALL·E
    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: imageSize
    });

    const imageUrl = imageResponse.data[0].url;

    // 2) Escape user prompt for safe insertion into HTML
    const escapedPrompt = prompt
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 3) Build a fun, styled HTML snippet
    const html =
      '<div style="font-family:\'Comic Neue\', sans-serif; ' +
      'background:#e0f7fa; color:#004d40; text-align:center; padding:1rem;">' +
      '<h2 style="color:#00796b; margin-bottom:0.5rem;">Your AI Creation</h2>' +
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
      'from { transform: scale(0.8); opacity: 0.5; }' +
      'to { transform: scale(1); opacity: 1; }' +
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
        '</div>'
    });
  }
});

app.listen(port, () => {
  console.log('Server running on port ' + port);
});

