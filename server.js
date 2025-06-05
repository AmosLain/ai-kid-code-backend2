const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');

dotenv.config();

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/generate', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

  try {
    // STEP 1: Generate image from prompt
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024"
    });
    const imageUrl = imageResponse.data[0].url;

    // STEP 2: Ask GPT to build HTML with that image
    const codeResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a kids' site assistant. Use this image in the page: ${imageUrl}. 
Generate a beautiful full HTML page for kids using this image in a fun, colorful, and magical way. 
No markdown. Use emojis, animations, and creative layout. Output HTML only.`
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.9,
    });

    const code = codeResponse.choices[0].message.content;
    console.log("✅ Generated HTML with image:", imageUrl);
    res.json({ code });

  } catch (err) {
    console.error('❌ Error during generation:', err.response?.data || err.message || err);
    res.status(500).json({ error: 'Failed to generate code' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
