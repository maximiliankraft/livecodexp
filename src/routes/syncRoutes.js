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

router.post('/update', async (req, res) => {
    const data = req.body;
    console.log("Received update:", data);

    // Send the update to all connected clients
    eventManager.sendUpdate({ type: 'update', content: data.content, isInitial: data.isInitial });
    
    res.status(200).send('Update published');
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
