import express from 'express';
import path from 'path';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles only
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    }
  }
}));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  skip: (req) => req.method === 'OPTIONS',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Allow OPTIONS preflight for /api/generate
app.options('/api/generate', cors({ origin: true, credentials: true }));

// Serve static files from public
app.use(express.static(path.join(__dirname, 'public')));

// Your existing /api/generate handler (adjust or add your actual OpenAI call here)
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).send('Prompt is required');

    // Dummy response for testing, replace with your OpenAI logic
    const html = `<div><h2>Your prompt:</h2><p>${prompt}</p><img src="https://via.placeholder.com/400x200?text=AI+Image" alt="Generated"/></div>`;

    res.json({ code: html });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
