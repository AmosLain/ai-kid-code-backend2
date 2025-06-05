const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/generate', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that always responds with fully working HTML/CSS/JS code only. No explanations. Output only code that runs directly in the browser. Keep it simple and safe for kids.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
    });

    const code = response.choices[0].message.content;

    // Log raw AI response for debugging
    console.log('🧠 AI raw output:\n', code);

    res.json({ code });

  } catch (err) {
    console.error('❌ OpenAI error:', err.message || err);
    res.status(500).json({ error: 'Failed to generate code' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
