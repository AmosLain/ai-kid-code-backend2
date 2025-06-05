const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY  // Make sure this is set in your Render environment variables
});

app.post('/generate', async (req, res) => {
  const prompt = req.body.prompt;
  if (!prompt) return res.json({ code: "<h2>Prompt is missing</h2>" });

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024"
    });

    const imageUrl = response.data[0].url;
    const html = `<img src="${imageUrl}" alt="Generated Image" style="max-width:100%;height:auto;">`;

    res.json({ code: html });
  } catch (error) {
    console.error("Image generation error:", error);
    res.json({ code: `<h2>Error generating image</h2><pre>${error.message}</pre>` });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});


app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
