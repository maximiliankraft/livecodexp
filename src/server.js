import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { router as syncRouter } from './routes/syncRoutes.js';
import EventManager from './routes/syncRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import sessionManager from './services/sessionManager.js';

// Create dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
export const eventManager = new EventManager();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com', 'unpkg.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com', 'unpkg.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for some external resources
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all requests
app.use(limiter);

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || uuidv4(),
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(cookieParser());
app.use(bodyParser.json({ limit: '5mb' })); // Limit request size
app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }));

// Custom middleware to set client ID
app.use((req, res, next) => {
  if (!req.session.clientId) {
    req.session.clientId = uuidv4();
  }
  next();
});

// Routes
app.use('/sync', syncRouter);
app.use('/api/sessions', (req, res, next) => {
  req.sessionManager = sessionManager;
  next();
});

// Session API routes
app.get('/api/sessions', (req, res) => {
  try {
    const sessions = sessionManager.getAllSessions();
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Session name is required' });
    }
    
    const sessionId = sessionManager.createSession(name);
    const joined = sessionManager.joinSession(sessionId, req.session.clientId);
    const claimed = sessionManager.claimSession(sessionId, req.session.clientId);
    
    req.session.currentSession = sessionId;
    req.session.isOwner = true;
    
    res.json({ 
      sessionId, 
      success: true,
      isOwner: true
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions/join', (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    const session = sessionManager.joinSession(sessionId, req.session.clientId);
    req.session.currentSession = sessionId;
    req.session.isOwner = false;
    
    res.json({ 
      success: true,
      session: {
        id: session.id,
        name: session.name
      }
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.get('/api/sessions/current', (req, res) => {
  try {
    if (!req.session.currentSession) {
      return res.json({ inSession: false });
    }
    
    const stats = sessionManager.getSessionStats(req.session.currentSession);
    res.json({
      inSession: true,
      isOwner: req.session.isOwner,
      session: stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions/leave', (req, res) => {
  try {
    if (req.session.currentSession) {
      sessionManager.leaveSession(req.session.currentSession, req.session.clientId);
      req.session.currentSession = null;
      req.session.isOwner = false;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SSE endpoint
app.get('/events', (req, res) => {
    // Check if user is in a session
    if (!req.session.currentSession) {
        return res.status(403).json({ error: 'Not part of a session' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Associate this client with a specific session
    const clientData = {
        res,
        sessionId: req.session.currentSession
    };

    eventManager.addClient(clientData);

    req.on('close', () => {
        eventManager.removeClient(clientData);
    });
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Redirect root to landing page
app.get('/', (req, res) => {
    res.redirect('/index.html');
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ 
        error: 'Server error',
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message 
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});