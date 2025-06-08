const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const winston = require('winston');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-kid-code-backend' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "https://api.openai.com", "https://image.pollinations.ai"]
    }
  }
}));

// Rate limiting - more generous for kids
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: {
    error: 'Too many requests, please try again later!',
    translations: {
      en: 'Too many requests, please try again later!',
      he: 'יותר מדי בקשות, נסה שוב מאוחר יותר!',
      es: '¡Demasiadas solicitudes, inténtalo de nuevo más tarde!',
      fr: 'Trop de demandes, veuillez réessayer plus tard!'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);
app.use(compression());
app.use(express.json({ limit: '1mb' }));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://enterhere.vip', 'https://www.enterhere.vip']
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500'],
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Kid-safe prompt filter
const kidSafeFilter = (prompt) => {
  const inappropriateWords = [
    'violence', 'weapon', 'gun', 'knife', 'blood', 'death', 'kill', 'hurt',
    'scary', 'monster', 'demon', 'devil', 'hell', 'damn', 'stupid', 'hate'
  ];
  
  const lowerPrompt = prompt.toLowerCase();
  const foundInappropriate = inappropriateWords.find(word => 
    lowerPrompt.includes(word)
  );
  
  if (foundInappropriate) {
    return {
      safe: false,
      reason: `Let's try something more positive instead of "${foundInappropriate}"!`
    };
  }
  
  return { safe: true };
};

// Enhanced prompt for kid-friendly content
const enhancePrompt = (originalPrompt, lang = 'en') => {
  const styleEnhancers = {
    en: "cartoon style, colorful, child-friendly, happy, bright colors, cute, playful",
    he: "סגנון קריקטורה, צבעוני, ידידותי לילדים, שמח, צבעים בהירים, חמוד, שובב",
    es: "estilo de dibujos animados, colorido, apropiado para niños, feliz, colores brillantes, lindo, juguetón",
    fr: "style cartoon, coloré, adapté aux enfants, joyeux, couleurs vives, mignon, ludique"
  };
  
  const enhancer = styleEnhancers[lang] || styleEnhancers.en;
  return `${originalPrompt}, ${enhancer}`;
};

// Generate HTML with embedded image
const generateHTML = (imageUrl, prompt, lang = 'en') => {
  const translations = {
    en: {
      title: "My AI Creation",
      description: "I created this with AI!",
      prompt: "My prompt was",
      madeby: "Made with EnterHere.vip"
    },
    he: {
      title: "היצירה שלי עם AI",
      description: "יצרתי את זה עם בינה מלאכותית!",
      prompt: "הפרומפט שלי היה",
      madeby: "נוצר עם EnterHere.vip"
    },
    es: {
      title: "Mi Creación con IA",
      description: "¡Creé esto con IA!",
      prompt: "Mi prompt fue",
      madeby: "Hecho con EnterHere.vip"
    },
    fr: {
      title: "Ma Création IA",
      description: "J'ai créé ceci avec l'IA !",
      prompt: "Mon prompt était",
      madeby: "Fait avec EnterHere.vip"
    }
  };
  
  const t = translations[lang] || translations.en;
  
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t.title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Baloo+2&family=Comic+Neue&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Baloo 2', cursive;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 2rem;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            color: white;
            text-align: center;
        }
        .container {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 2rem;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 800px;
            color: #333;
        }
        h1 {
            color: #1e88e5;
            font-size: 2.5rem;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        }
        .image-container {
            margin: 2rem 0;
            position: relative;
            display: inline-block;
        }
        img {
            max-width: 100%;
            height: auto;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            transition: transform 0.3s ease;
        }
        img:hover {
            transform: scale(1.02);
        }
        .prompt-display {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 10px;
            margin: 1rem 0;
            border-left: 4px solid #1e88e5;
            font-style: italic;
        }
        .footer {
            margin-top: 2rem;
            font-size: 0.9rem;
            color: #666;
        }
        .sparkle {
            font-size: 1.5rem;
            animation: sparkle 2s infinite;
        }
        @keyframes sparkle {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
        }
        @media (max-width: 600px) {
            body { padding: 1rem; }
            .container { padding: 1rem; }
            h1 { font-size: 2rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${t.title} <span class="sparkle">✨</span></h1>
        <p style="font-size: 1.2rem; color: #666;">${t.description}</p>
        
        <div class="image-container">
            <img src="${imageUrl}" alt="AI Generated Art" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIExvYWRpbmc8L3RleHQ+PC9zdmc+';">
        </div>
        
        <div class="prompt-display">
            <strong>${t.prompt}:</strong> "${prompt}"
        </div>
        
        <div class="footer">
            ${t.madeby} 🎨
        </div>
    </div>
</body>
</html>`;
};

// Validation middleware
const validateGenerate = [
  body('prompt')
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage('Prompt must be between 3 and 500 characters')
    .matches(/^[a-zA-Z0-9\s\-_.,!?'"()]+$/)
    .withMessage('Prompt contains invalid characters'),
  body('size')
    .isIn(['512x512', '1024x1024'])
    .withMessage('Invalid size parameter'),
  body('lang')
    .optional()
    .isIn(['en', 'he', 'es', 'fr'])
    .withMessage('Invalid language parameter')
];

// Main generate endpoint
app.post('/generate', validateGenerate, async (req, res) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation failed', { errors: errors.array(), ip: req.ip });
      return res.status(400).json({
        error: 'Invalid input',
        details: errors.array()
      });
    }

    const { prompt, size = '512x512', lang = 'en' } = req.body;
    
    // Kid-safe filter
    const safetyCheck = kidSafeFilter(prompt);
    if (!safetyCheck.safe) {
      logger.info('Unsafe prompt filtered', { prompt, ip: req.ip });
      return res.status(400).json({
        error: safetyCheck.reason,
        suggestions: [
          'A happy rainbow with clouds',
          'A cute puppy playing in a garden',
          'A colorful butterfly among flowers',
          'A friendly dragon reading a book'
        ]
      });
    }

    logger.info('Generation request', { prompt, size, lang, ip: req.ip });

    // Enhance prompt for kid-friendly results
    const enhancedPrompt = enhancePrompt(prompt, lang);
    
    // Generate image using Pollinations AI (free and reliable)
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=${size.split('x')[0]}&height=${size.split('x')[1]}&seed=${Math.floor(Math.random() * 1000000)}`;
    
    // Generate HTML with the image
    const htmlCode = generateHTML(imageUrl, prompt, lang);
    
    logger.info('Generation successful', { prompt, size, lang, ip: req.ip });
    
    res.json({
      success: true,
      code: htmlCode,
      imageUrl: imageUrl,
      originalPrompt: prompt,
      enhancedPrompt: enhancedPrompt
    });

  } catch (error) {
    logger.error('Generation error', { 
      error: error.message, 
      stack: error.stack, 
      prompt: req.body.prompt,
      ip: req.ip 
    });
    
    res.status(500).json({
      error: 'Something went wrong! Please try again.',
      translations: {
        en: 'Something went wrong! Please try again.',
        he: 'משהו השתבש! אנא נסה שוב.',
        es: '¡Algo salió mal! Por favor, inténtalo de nuevo.',
        fr: 'Quelque chose s\'est mal passé ! Veuillez réessayer.'
      }
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Serve static files for development
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static('public'));
}

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error', { 
    error: error.message, 
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn('404 Not Found', { url: req.url, method: req.method, ip: req.ip });
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, () => {
  logger.info(`🚀 AI Kid Code Backend running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
