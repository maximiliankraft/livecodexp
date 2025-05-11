import express from 'express';

export const router = express.Router();
import { eventManager } from '../server.js'; // Import the event manager instance

export default class EventManager {
    constructor() {
        this.clients = [];
        this.currentState = null; // Store the current state of the content
    }

    addClient(res) {
        console.debug("Adding new client to event stream");
        this.clients.push(res);

        // Send the current state to the newly connected client
        if (this.currentState) {
            console.log("Sending current state to new client");
            
            // Format data correctly for SSE
            res.write(`data: ${JSON.stringify(this.currentState)}\n\n`);
            
            // If we have accumulated updates, send them too
            if (this.currentState.updates && this.currentState.updates.length > 0) {
                console.log(`Sending ${this.currentState.updates.length} accumulated updates to new client`);
                // We don't send these updates individually since they've already been applied to the initial state
            }
        } else {
            console.log("No current state to send to new client");
        }
    }

    removeClient(res) {
        console.debug("Removing client from event stream");
        this.clients = this.clients.filter(client => client !== res);
    }

    sendUpdate(data) {
        console.debug("Sending update to clients");
        console.debug(data);
        this.currentState = data; // Update the current state
        this.clients.forEach(client => {
            client.write(`data: ${JSON.stringify(data)}\n\n`);
        });
    }
}

router.post('/initial', async (req, res) => {
    const content = req.body.content;

    eventManager.sendUpdate({ type: 'initial', content });
    res.status(200).send('Initial content published');
});

router.post('/update', async (req, res) => {
    const updates = req.body.updates;
    console.log("Received updates:", updates);

    // Send the updates to all connected clients
    eventManager.sendUpdate({ type: 'update', updates });
    
    // Store updates in the current state for new clients
    if (!eventManager.currentState) {
        eventManager.currentState = { type: 'initial', content: {} };
    }
    
    // Ensure we have an updates array in the current state
    if (!eventManager.currentState.updates) {
        eventManager.currentState.updates = [];
    }
    
    // Store these updates for future clients
    eventManager.currentState.updates.push(...updates);
    
    res.status(200).send('Updates published');
});

router.get('/events', (req, res) => {
    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Add the client to the event stream
    eventManager.addClient(res);

    // Remove the client when the connection is closed
    req.on('close', () => {
        eventManager.removeClient(res);
    });
});
