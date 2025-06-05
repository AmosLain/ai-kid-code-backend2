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
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are an expert children's web developer assistant. When given a prompt, you output full working HTML/CSS/JS code with colorful, fun, cartoon-style visuals.

Do not include markdown formatting like \`\`\`. Your output must be fully browser-renderable.

Use fun layouts, emojis, animations, real image URLs from Unsplash or Wikimedia Commons, and avoid plain green boxes or abstract shapes.

Your audience is 5–10 year olds, so your code should be safe, engaging, and magical. Output only the code, nothing else.`
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.9,
    });

    const code = response.choices[0].message.content;
    console.log("🧠 AI Response:\n", code);
    res.json({ code });

  } catch (err) {
    console.error('🔥 OpenAI backend crash:', err.response?.data || err.message || err);
    res.status(500).json({ error: 'Failed to generate code' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
