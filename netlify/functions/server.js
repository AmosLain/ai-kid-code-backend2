const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { OpenAI } = require('openai');
const serverless = require('serverless-http');

const app = express();

// Security middleware with basic Content Security Policy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// Rate limiting - prevent API abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes per IP
  message: {
    code: createErrorHTML(
      'Too many requests from your IP address.',
      'Please wait 15 minutes before trying again.'
    )
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to the generate endpoint
app.use('/generate', limiter);

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? 
    process.env.CORS_ORIGIN.split(',') : 
    ['http://localhost:3000', 'http://127.0.0.1:5500', 'https://enterhere.vip'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Utility function to create consistent error HTML
function createErrorHTML(message, details = '') {
  return `
    <div style="font-family:'Comic Neue', sans-serif; 
                background:linear-gradient(135deg, #ffebee 0%, #fce4ec 100%); 
                color:#c62828; text-align:center; padding:2rem; 
                border:3px solid #e53935; border-radius:15px; 
                box-shadow:0 4px 20px rgba(229,57,53,0.3);
                animation: shakeError 0.5s ease-in-out;">
      <h2 style="margin:0 0 1rem 0; font-size:1.8rem;">🤖 Oops! Something went wrong</h2>
      <p style="font-size:1.2rem; margin:1rem 0; line-height:1.4;">${message}</p>
      ${details ? `<p style="font-size:1rem; opacity:0.8; margin:1rem 0;">${details}</p>` : ''}
      <div style="margin-top:1.5rem;">
        <button onclick="window.history.back()" 
                style="background:linear-gradient(135deg, #4caf50 0%, #45a049 100%); 
                       color:white; border:none; padding:12px 25px; 
                       border-radius:25px; cursor:pointer; font-size:1rem;
                       box-shadow:0 2px 10px rgba(76,175,80,0.3);
                       transition:transform 0.2s;"
                onmouseover="this.style.transform='scale(1.05)'"
                onmouseout="this.style.transform='scale(1)'">
          🔄 Try Again
        </button>
      </div>
      <style>
        @keyframes shakeError {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      </style>
    </div>
  `;
}

// Utility function to validate kid-friendly content
function isKidFriendly(prompt) {
  const inappropriateWords = [
    'violence', 'scary', 'dangerous', 'weapon', 'blood', 'death', 
    'kill', 'hurt', 'fight', 'war', 'monster', 'ghost', 'demon',
    'nightmare', 'terror', 'horror', 'evil', 'dark', 'destroy'
  ];
  const lowerPrompt = prompt.toLowerCase();
  return !inappropriateWords.some(word => lowerPrompt.includes(word));
}

// Utility function to create success HTML with image
function createImageHTML(imageUrl, prompt, languageInstruction = '') {
  const escapedPrompt = prompt
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return `
    ${languageInstruction ? `<!-- ${languageInstruction} -->` : ''}
    <div style="font-family:'Comic Neue', 'Comic Sans MS', cursive; 
                background:linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 50%, #80deea 100%); 
                color:#004d40; text-align:center; padding:2rem; 
                border-radius:20px; box-shadow:0 8px 32px rgba(0,77,64,0.2);
                max-width:800px; margin:0 auto;">
      <h2 style="color:#00796b; margin:0 0 1.5rem 0; font-size:2.2rem; 
                 text-shadow:2px 2px 4px rgba(0,121,107,0.3);
                 animation: bounceIn 1s ease-out;">
        🎨 Your Amazing AI Creation! ✨
      </h2>
      <div style="position:relative; display:inline-block; margin:1rem 0;">
        <img src="${imageUrl}" 
             alt="AI-Generated Image for Kids" 
             style="max-width:90%; height:auto; 
                    border:6px solid #004d40; 
                    border-radius:15px; 
                    box-shadow:0 8px 25px rgba(0,77,64,0.4);
                    animation: zoomIn 1.2s ease-out;
                    transition:transform 0.3s ease;"
             onmouseover="this.style.transform='scale(1.02)'"
             onmouseout="this.style.transform='scale(1)'">
        <div style="position:absolute; top:-10px; right:-10px; 
                    background:#ff6b6b; color:white; 
                    border-radius:50%; width:40px; height:40px; 
                    display:flex; align-items:center; justify-content:center;
                    font-size:1.5rem; animation: pulse 2s infinite;">
          ⭐
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.7); 
                  padding:1.5rem; border-radius:15px; 
                  margin:1.5rem 0; backdrop-filter:blur(10px);">
        <p style="margin:0; font-size:1.1rem; line-height:1.6;">
          <strong style="color:#00695c;">Your Creative Prompt:</strong><br>
          <em style="color:#00796b; font-size:1.05rem;">"${escapedPrompt}"</em>
        </p>
      </div>
      <div style="margin-top:2rem;">
        <button onclick="window.print()" 
                style="background:linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%); 
                       color:white; border:none; padding:12px 25px; 
                       border-radius:25px; margin:0 10px; cursor:pointer; 
                       font-size:1rem; box-shadow:0 4px 15px rgba(255,107,107,0.4);
                       transition:all 0.3s ease;"
                onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(255,107,107,0.6)'"
                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(255,107,107,0.4)'">
          🖨️ Print My Art
        </button>
        <button onclick="navigator.share ? navigator.share({title: 'My AI Art', url: '${imageUrl}'}) : alert('Right-click the image to save!')" 
                style="background:linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%); 
                       color:white; border:none; padding:12px 25px; 
                       border-radius:25px; margin:0 10px; cursor:pointer; 
                       font-size:1rem; box-shadow:0 4px 15px rgba(78,205,196,0.4);
                       transition:all 0.3s ease;"
                onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(78,205,196,0.6)'"
                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(78,205,196,0.4)'">
          📱 Share My Art
        </button>
      </div>
      <style>
        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes zoomIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @media (max-width: 600px) {
          div[style*="font-family"] { padding: 1rem !important; }
          h2 { font-size: 1.8rem !important; }
          img { max-width: 95% !important; }
          button { display: block !important; margin: 10px auto !important; width: 200px; }
        }
      </style>
    </div>
  `;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Main image generation endpoint
app.post('/generate', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { prompt, size, lang } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        code: createErrorHTML(
          'Please provide a creative prompt for your AI art!',
          'Tell me what you want to create - like "a happy rainbow dragon"'
        )
      });
    }

    if (prompt.length > 1000) {
      return res.status(400).json({
        code: createErrorHTML(
          'Your prompt is too long!',
          'Please keep it under 1000 characters'
        )
      });
    }

    if (!isKidFriendly(prompt)) {
      return res.status(400).json({
        code: createErrorHTML(
          'Let\'s keep it fun and friendly! 😊',
          'Try something happy, colorful, or magical'
        )
      });
    }

    const validSizes = ['512x512', '1024x1024'];
    if (size && !validSizes.includes(size)) {
      return res.status(400).json({
        code: createErrorHTML(
          'Invalid image size selected',
          'Choose "Small" or "Large"'
        )
      });
    }

    const validLanguages = ['en', 'he', 'es', 'fr'];
    if (lang && !validLanguages.includes(lang)) {
      return res.status(400).json({
        code: createErrorHTML(
          'Unsupported language',
          'Use English, Hebrew, Spanish, or French'
        )
      });
    }

    let imageModel, imageSize;
    if (size === '512x512') {
      imageModel = 'dall-e-2';
      imageSize = '256x256';
    } else {
      imageModel = 'dall-e-3';
      imageSize = '1024x1024';
    }

    const languageNames = { he: 'Hebrew', es: 'Spanish', fr: 'French' };
    const fullLang = languageNames[lang] || (lang === 'en' ? 'English' : null);
    const languageInstruction = fullLang && fullLang !== 'English' 
      ? `Respond in ${fullLang}` 
      : '';

    console.log(`[${new Date().toISOString()}] Image generation request:`, {
      promptLength: prompt.length,
      promptPreview: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
      size: imageSize,
      model: imageModel,
      language: lang || 'en',
      ip: req.ip
    });

    const imageResponse = await openai.images.generate({
      model: imageModel,
      prompt: prompt,
      n: 1,
      size: imageSize,
      quality: imageModel === 'dall-e-3' ? 'standard' : undefined,
      style: imageModel === 'dall-e-3' ? 'natural' : undefined,
    });

    const imageUrl = imageResponse.data[0].url;
    const processingTime = Date.now() - startTime;

    console.log(`[${new Date().toISOString()}] Image generated successfully:`, {
      model: imageModel,
      size: imageSize,
      processingTime: `${processingTime}ms`,
      url: imageUrl ? 'Generated' : 'Failed'
    });

    return res.json({ 
      code: createImageHTML(imageUrl, prompt, languageInstruction),
      metadata: {
        model: imageModel,
        size: imageSize,
        processingTime,
        language: lang || 'en'
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Image generation error:`, {
      error: error.message,
      code: error.code,
      type: error.type,
      processingTime: `${processingTime}ms`,
      prompt: req.body.prompt ? req.body.prompt.substring(0, 50) : 'undefined'
    });

    let errorMessage = 'Something went wrong creating your AI art';
    let errorDetails = '';

    if (error.code === 'insufficient_quota') {
      errorMessage = 'The AI art service is temporarily unavailable';
      errorDetails = 'Please try again later';
    } else if (error.code === 'invalid_request_error') {
      errorMessage = 'There was a problem with your request';
      errorDetails = 'Try describing your idea differently';
    } else if (error.code === 'rate_limit_exceeded') {
      errorMessage = 'Too many people are creating art right now';
      errorDetails = 'Please wait a moment and try again';
    } else if (error.message && error.message.includes('content_policy_violation')) {
      errorMessage = 'Let\'s try a different creative idea! 🎨';
      errorDetails = 'Try something fun and colorful instead!';
    }

    return res.status(500).json({
      code: createErrorHTML(errorMessage, errorDetails),
      error: {
        type: error.code || 'unknown_error',
        processingTime
      }
    });
  }
});

// Handle 404 errors
app.use('*', (req, res) => {
  res.status(404).json({
    code: createErrorHTML(
      'Page not found! 🔍',
      'Try using /generate for creating AI art!'
    )
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Unhandled error:`, {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });
  res.status(500).json({
    code: createErrorHTML(
      'Something unexpected happened! 😅',
      'Please try again in a moment.'
    )
  });
});

module.exports.handler = serverless(app);