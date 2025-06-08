const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'"]
        }
    }
}));

// CORS configuration
app.use(cors({
    origin: true,
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        code: '<div style="font-family:sans-serif; color:red; text-align:center; padding:2rem;"><h2>Rate Limit Exceeded</h2><p>Please wait a moment before trying again.</p></div>'
    }
});

app.use('/api/', limiter);

// Body parser middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static('public'));

// Content filtering function
function containsInappropriateContent(text) {
    const inappropriateWords = [
        'violent', 'scary', 'murder', 'kill', 'death', 'blood',
        'weapon', 'gun', 'knife', 'fight', 'hate', 'stupid',
        'dumb', 'idiot', 'ugly', 'fat', 'loser', 'naked', 'nude'
    ];
    
    const lowerText = text.toLowerCase();
    return inappropriateWords.some(word => lowerText.includes(word));
}

// Language detection and translation
const languageNames = { 
    he: 'Hebrew', 
    es: 'Spanish', 
    fr: 'French' 
};

function detectLanguage(text) {
    // Simple language detection based on character patterns
    if (/[\u0590-\u05FF]/.test(text)) return 'he'; // Hebrew
    if (/[ñáéíóúü]/.test(text.toLowerCase())) return 'es'; // Spanish
    if (/[àâäéèêëïîôöùûüÿç]/.test(text.toLowerCase())) return 'fr'; // French
    return 'en'; // Default to English
}

// Main image generation endpoint
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, size, lang } = req.body;

        // Validation
        if (!prompt) {
            return res.json({
                code: '<div style="font-family:sans-serif; color:red; text-align:center; padding:2rem;"><h2>Error: Prompt is missing</h2><p>Please enter a description for your artwork!</p></div>'
            });
        }

        if (prompt.length > 500) {
            return res.json({
                code: '<div style="font-family:sans-serif; color:red; text-align:center; padding:2rem;"><h2>Error: Prompt too long</h2><p>Please keep your description under 500 characters.</p></div>'
            });
        }

        // Content filtering
        if (containsInappropriateContent(prompt)) {
            return res.json({
                code: '<div style="font-family:sans-serif; color:red; text-align:center; padding:2rem;"><h2>Oops! Let\'s keep it kid-friendly</h2><p>Please use positive, fun words in your artwork description!</p></div>'
            });
        }

        // Determine image model and size based on user selection
        let imageModel, imageSize;
        
        if (size === '512x512') {
            // Use DALL-E-2 for faster, smaller images
            imageModel = 'dall-e-2';
            imageSize = '256x256';
        } else {
            // Default to DALL-E-3 for detailed images
            imageModel = 'dall-e-3';
            imageSize = '1024x1024';
        }

        // Build language instruction if needed
        const detectedLang = detectLanguage(prompt);
        const fullLang = languageNames[lang] || (lang === 'en' ? 'English' : null);
        const languageInstruction = 
            fullLang && fullLang !== 'English'
                ? `Respond in ${fullLang}.`
                : '';

        try {
            // Generate image with OpenAI
            const imageResponse = await openai.images.generate({
                model: imageModel,
                prompt: prompt,
                n: 1,
                size: imageSize,
            });

            const imageUrl = imageResponse.data[0].url;

            // Escape the prompt for safe HTML insertion
            const escapedPrompt = prompt
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            // Build kid-friendly HTML response
            const html = 
                '<!-- ' + 
                languageInstruction +
                '-->' +
                '<div style="font-family:\'Comic Neue\', sans-serif; ' +
                'background:#e0f7fa; color:#004d40; text-align:center; padding:1rem;">' +
                '<h2 style="color:#00796b; margin-bottom:0.5rem;">Your AI Creation</h2>' +
                // Display the image at up to 80% width; if it was 256x256, it'll scale up nicely
                '<img src="' + 
                imageUrl + 
                '" alt="AI-Generated Image" ' +
                'style="max-width:80%; height:auto; border:5px solid #004d40; ' +
                'border-radius:10px; box-shadow:0 0 10px rgba(0,0,0,0.2); ' +
                'animation: zoomIn 1s ease-in-out;">' +
                '<p style="margin-top:0.5rem; font-size:1rem;">Prompt: <em>' +
                escapedPrompt +
                '</em></p>' +
                '<style>' +
                '@keyframes zoomIn {' +
                'from { transform: scale(0.8); opacity: 0.5; } ' +
                'to { transform: scale(1); opacity: 1; } ' +
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
                    '<p style="white-space:pre-wrap;">' + 
                    errMsg + 
                    '</p>' +
                    '</div>'
            });
        }

    } catch (error) {
        console.error('Server error:', error);
        return res.json({
            code: '<div style="font-family:sans-serif; color:red; text-align:center; padding:2rem;"><h2>Server Error</h2><p>Something went wrong. Please try again!</p></div>'
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        code: '<div style="font-family:sans-serif; color:red; text-align:center; padding:2rem;"><h2>Something went wrong!</h2><p>Please try again later.</p></div>'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        code: '<div style="font-family:sans-serif; color:orange; text-align:center; padding:2rem;"><h2>Page not found</h2><p>The page you\'re looking for doesn\'t exist.</p></div>'
    });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 EnterHere.vip server running on port ${port}`);
    console.log(`📝 Make sure to set your OPENAI_API_KEY environment variable`);
});


