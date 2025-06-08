import express from 'express';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Serving from:', path.join(__dirname, 'public'));
console.log('Index.html exists:', fs.existsSync(path.join(__dirname, 'public', 'index.html')));
console.log('Main.js exists:', fs.existsSync(path.join(__dirname, 'public', 'main.js')));

const app = express();
const PORT = process.env.PORT || 10000;

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

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

app.options('/api/generate', cors({ origin: true, credentials: true }));

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Explicit route for root to serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Your /api/generate route
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).send('Prompt is required');

    // Dummy response for testing — replace with your OpenAI integration
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
