import express from 'express';
import sessionManager from '../services/sessionManager.js';

export const router = express.Router();
import { eventManager } from '../server.js'; // Import the event manager instance

export default class EventManager {
    constructor() {
        this.clients = [];
        this.sessionStates = new Map(); // Store the current state for each session
    }

    addClient(clientData) {
        console.debug("Adding new client to event stream");
        this.clients.push(clientData);

        // Send the current state to the newly connected client
        const sessionId = clientData.sessionId;
        if (sessionId && this.sessionStates.has(sessionId)) {
            console.log("Sending current session state to new client");
            
            // Format data correctly for SSE
            clientData.res.write(`data: ${JSON.stringify(this.sessionStates.get(sessionId))}\n\n`);
        } else {
            console.log("No current state to send to new client");
        }
    }

    removeClient(clientData) {
        console.debug("Removing client from event stream");
        this.clients = this.clients.filter(client => client.res !== clientData.res);
    }

    sendUpdate(data, sessionId) {
        console.debug(`Sending update to clients in session ${sessionId}`);
        
        // Store the state for this session
        this.sessionStates.set(sessionId, data);
        
        // Send to clients in the specified session
        this.clients.forEach(client => {
            if (client.sessionId === sessionId) {
                client.res.write(`data: ${JSON.stringify(data)}\n\n`);
            }
        });
    }
}

// Middleware to ensure user is in a session
const requireSession = (req, res, next) => {
    if (!req.session.currentSession) {
        return res.status(403).json({ error: 'You must be in a session to perform this action' });
    }
    next();
};

// Middleware to ensure user is session owner
const requireOwnership = (req, res, next) => {
    if (!req.session.isOwner) {
        return res.status(403).json({ error: 'Only the session owner can perform this action' });
    }
    next();
};

router.post('/update', requireSession, async (req, res) => {
    try {
        const sessionId = req.session.currentSession;
        const data = req.body;
        
        if (data.isInitial) {
            console.log(`Received initial content for session ${sessionId}`);
            
            // Add file size tracking for session limits (for initial content)
            if (data.content && data.content.files) {
                Object.values(data.content.files).forEach(file => {
                    // Skip directories
                    if (file.type === 'directory') return;
                    
                    // For content, estimate size based on content length
                    if (file.content) {
                        const fileInfo = {
                            path: file.path,
                            size: Buffer.byteLength(file.content, 'utf8'),
                            type: file.type
                        };
                        
                        try {
                            sessionManager.updateFileInSession(sessionId, fileInfo);
                        } catch (error) {
                            return res.status(400).json({ error: error.message });
                        }
                    }
                });
            }
            
            // Send the full content to clients for initial load
            eventManager.sendUpdate({ 
                type: 'update', 
                content: data.content, 
                isInitial: true,
                sessionId: sessionId
            }, sessionId);
        } else {
            // This is an incremental update with only changed files
            console.log(`Received incremental update for session ${sessionId} with ${Object.keys(data.changes || {}).length} changes`);
            
            // Add file size tracking for newly changed files
            if (data.changes) {
                Object.entries(data.changes).forEach(([path, fileData]) => {
                    // Skip directories and deleted files
                    if (fileData.kind === 'directory' || fileData.kind === 'deleted') return;
                    
                    // For files with content, update size tracking
                    if (fileData.kind === 'file' && fileData.data) {
                        const fileInfo = {
                            path: path,
                            size: Buffer.byteLength(fileData.data, 'utf8'),
                            type: fileData.type || 'modified'
                        };
                        
                        try {
                            sessionManager.updateFileInSession(sessionId, fileInfo);
                        } catch (error) {
                            console.error(`Error updating file in session: ${error.message}`);
                            // Continue processing other files instead of failing the whole update
                        }
                    }
                });
            }
            
            // Send only the changes to clients
            eventManager.sendUpdate({ 
                type: 'update', 
                changes: data.changes, 
                isInitial: false,
                sessionId: sessionId
            }, sessionId);
        }
        
        res.status(200).send('Update published');
    } catch (error) {
        console.error('Error updating session:', error);
        res.status(500).json({ error: 'Failed to update session data' });
    }
});

// Get session stats
router.get('/stats', requireSession, (req, res) => {
    try {
        const sessionId = req.session.currentSession;
        const stats = sessionManager.getSessionStats(sessionId);
        
        // Add default values when missing to ensure UI display works correctly
        const response = {
            ...stats,
            fileCount: stats.fileCount || 0,
            totalSize: stats.totalSize || 0,
            maxSize: stats.maxSize || (50 * 1024 * 1024),
            maxFiles: stats.maxFiles || 500
        };
        
        res.json(response);
    } catch (error) {
        console.error('Error getting session stats:', error);
        // Return fallback stats even in case of error
        res.json({
            fileCount: 0,
            totalSize: 0,
            maxSize: 50 * 1024 * 1024,
            maxFiles: 500
        });
    }
});

// This route is now handled in server.js
router.get('/events', (req, res) => {
    res.status(404).send('This endpoint is deprecated. Use the root /events endpoint.');
});
