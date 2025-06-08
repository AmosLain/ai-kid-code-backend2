const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult, query } = require('express-validator');
const winston = require('winston');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Winston Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'story-generator' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      mediaSrc: ["'self'", "blob:", "data:"],
      imgSrc: ["'self'", "data:", "blob:"]
    }
  }
}));

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: 'Too many search requests, please slow down.'
});

const videoLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 video generations per 5 minutes
  message: 'Video generation limit reached, please wait before trying again.'
});

app.use('/api/', limiter);
app.use('/api/search', searchLimiter);
app.use('/api/generate-video', videoLimiter);

// File Upload Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// In-memory storage for demo (use database in production)
let stories = [];
let searchIndex = new Map();

// Content filtering function
function containsInappropriateContent(text) {
  const inappropriateWords = [
    'violent', 'scary', 'murder', 'kill', 'death', 'blood',
    'weapon', 'gun', 'knife', 'fight', 'hate', 'stupid',
    'dumb', 'idiot', 'ugly', 'fat', 'loser'
  ];
  
  const lowerText = text.toLowerCase();
  return inappropriateWords.some(word => lowerText.includes(word));
}

// Build search index
function buildSearchIndex() {
  searchIndex.clear();
  stories.forEach((story, index) => {
    const words = (story.title + ' ' + story.content + ' ' + story.tags.join(' ')).toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 2) {
        if (!searchIndex.has(word)) {
          searchIndex.set(word, new Set());
        }
        searchIndex.get(word).add(index);
      }
    });
  });
}

// Search function with fuzzy matching
function searchStories(query, limit = 10) {
  if (!query || query.trim().length === 0) return [];
  
  const searchTerms = query.toLowerCase().trim().split(/\s+/);
  const results = new Map();
  
  searchTerms.forEach(term => {
    // Exact matches
    if (searchIndex.has(term)) {
      searchIndex.get(term).forEach(storyIndex => {
        results.set(storyIndex, (results.get(storyIndex) || 0) + 3);
      });
    }
    
    // Fuzzy matches
    for (const [word, storyIndices] of searchIndex.entries()) {
      if (word.includes(term) || term.includes(word)) {
        storyIndices.forEach(storyIndex => {
          results.set(storyIndex, (results.get(storyIndex) || 0) + 1);
        });
      }
    }
  });
  
  return Array.from(results.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([index]) => stories[index]);
}

// API Routes

// Story generation endpoint
app.post('/api/generate-story', [
  body('prompt').trim().isLength({ min: 5, max: 500 }).escape()
    .withMessage('Prompt must be between 5 and 500 characters'),
  body('age').optional().isInt({ min: 3, max: 12 })
    .withMessage('Age must be between 3 and 12'),
  body('theme').optional().isIn(['adventure', 'friendship', 'learning', 'animals', 'fantasy'])
    .withMessage('Invalid theme selected')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
        suggestions: ['Check your prompt length', 'Ensure age is between 3-12', 'Select a valid theme']
      });
    }

    const { prompt, age = 6, theme = 'adventure' } = req.body;

    if (containsInappropriateContent(prompt)) {
      logger.warn(`Inappropriate content detected in prompt: ${prompt}`);
      return res.status(400).json({
        success: false,
        message: 'Please use kid-friendly words in your story prompt!',
        suggestions: ['Try using positive, fun words', 'Think about adventures, animals, or friendship']
      });
    }

    // Simulate story generation (replace with actual AI service)
    const story = {
      id: Date.now(),
      title: `The Amazing Adventure of ${prompt.split(' ')[0]}`,
      content: `Once upon a time, there was a wonderful story about ${prompt}. This ${theme} tale was perfect for a ${age}-year-old, filled with joy, wonder, and important lessons about friendship and kindness...`,
      age,
      theme,
      tags: [theme, 'kid-friendly', 'educational'],
      createdAt: new Date().toISOString(),
      views: 0,
      likes: 0
    };

    stories.push(story);
    buildSearchIndex();

    logger.info(`Story generated successfully: ${story.id}`);
    res.json({ success: true, story });

  } catch (error) {
    logger.error('Story generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate story. Please try again.',
      suggestions: ['Check your internet connection', 'Try a simpler prompt', 'Contact support if problem persists']
    });
  }
});

// Text search endpoint
app.get('/api/search', [
  query('q').trim().isLength({ min: 1, max: 100 }).escape()
    .withMessage('Search query must be between 1 and 100 characters'),
  query('limit').optional().isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('theme').optional().isIn(['adventure', 'friendship', 'learning', 'animals', 'fantasy', 'all'])
    .withMessage('Invalid theme filter')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { q: query, limit = 10, theme } = req.query;
    
    let results = searchStories(query, parseInt(limit));
    
    // Apply theme filter if specified
    if (theme && theme !== 'all') {
      results = results.filter(story => story.theme === theme);
    }

    // Add search suggestions for empty results
    const suggestions = results.length === 0 ? [
      'Try different keywords',
      'Check spelling',
      'Use more general terms',
      'Browse by theme instead'
    ] : [];

    logger.info(`Search performed: "${query}" - ${results.length} results`);
    
    res.json({
      success: true,
      results,
      total: results.length,
      query,
      suggestions
    });

  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed. Please try again.',
      suggestions: ['Check your search terms', 'Try again in a moment']
    });
  }
});

// Video generation endpoint
app.post('/api/generate-video', upload.array('images', 10), [
  body('storyId').optional().isInt().withMessage('Invalid story ID'),
  body('title').trim().isLength({ min: 1, max: 100 }).escape()
    .withMessage('Title must be between 1 and 100 characters'),
  body('text').trim().isLength({ min: 10, max: 1000 }).escape()
    .withMessage('Text must be between 10 and 1000 characters'),
  body('style').optional().isIn(['animated', 'slideshow', 'kinetic-text', 'storybook'])
    .withMessage('Invalid video style'),
  body('duration').optional().isInt({ min: 5, max: 60 })
    .withMessage('Duration must be between 5 and 60 seconds')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { 
      storyId, 
      title, 
      text, 
      style = 'slideshow', 
      duration = 30 
    } = req.body;

    if (containsInappropriateContent(text) || containsInappropriateContent(title)) {
      return res.status(400).json({
        success: false,
        message: 'Please use kid-friendly content for video generation!',
        suggestions: ['Use positive, educational content', 'Avoid scary or inappropriate themes']
      });
    }

    // Simulate video generation process
    const videoJob = {
      id: `video_${Date.now()}`,
      title,
      text,
      style,
      duration,
      status: 'processing',
      progress: 0,
      createdAt: new Date().toISOString(),
      images: req.files ? req.files.map(file => file.filename) : [],
      storyId: storyId || null
    };

    // In a real implementation, you would:
    // 1. Queue the video generation job
    // 2. Use services like FFmpeg, Canvas API, or external APIs
    // 3. Process images and text into video
    // 4. Return job status and eventually the video URL

    logger.info(`Video generation started: ${videoJob.id}`);
    
    // Simulate processing time
    setTimeout(() => {
      videoJob.status = 'completed';
      videoJob.progress = 100;
      videoJob.videoUrl = `/videos/${videoJob.id}.mp4`;
    }, 5000);

    res.json({
      success: true,
      job: videoJob,
      message: 'Video generation started! Check status with the job ID.',
      estimatedTime: '30-60 seconds'
    });

  } catch (error) {
    logger.error('Video generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Video generation failed. Please try again.',
      suggestions: ['Check file formats', 'Reduce content length', 'Try again later']
    });
  }
});

// Video status endpoint
app.get('/api/video-status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // In production, query your job queue/database
    // For demo, return mock status
    res.json({
      success: true,
      job: {
        id: jobId,
        status: 'completed',
        progress: 100,
        videoUrl: `/videos/${jobId}.mp4`,
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Video status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get video status'
    });
  }
});

// Get all stories with pagination
app.get('/api/stories', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('theme').optional().isIn(['adventure', 'friendship', 'learning', 'animals', 'fantasy', 'all'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const theme = req.query.theme;
    
    let filteredStories = stories;
    if (theme && theme !== 'all') {
      filteredStories = stories.filter(story => story.theme === theme);
    }
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedStories = filteredStories.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      stories: paginatedStories,
      pagination: {
        current: page,
        limit,
        total: filteredStories.length,
        pages: Math.ceil(filteredStories.length / limit)
      }
    });

  } catch (error) {
    logger.error('Get stories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve stories'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 50MB.',
        suggestions: ['Compress your images', 'Use smaller files']
      });
    }
  }
  
  res.status(500).json({
    success: false,
    message: 'Something went wrong! Please try again.',
    suggestions: ['Refresh the page', 'Check your connection', 'Contact support']
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    suggestions: ['Check the URL', 'View API documentation']
  });
});

// Initialize server
async function startServer() {
  try {
    // Create necessary directories
    await fs.mkdir('logs', { recursive: true });
    await fs.mkdir('uploads', { recursive: true });
    await fs.mkdir('public/videos', { recursive: true });
    
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📝 Logs directory: ./logs/`);
      console.log(`📁 Uploads directory: ./uploads/`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
