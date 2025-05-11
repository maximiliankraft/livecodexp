import express from 'express';
import bodyParser from 'body-parser';
import { router as syncRouter } from './routes/syncRoutes.js';
import EventManager from './routes/syncRoutes.js';
import path from 'path';
import { log } from 'console';

const app = express();
const PORT = process.env.PORT || 3000;
export const eventManager = new EventManager();

// serve static files from the public directory
const __dirname = path.resolve();

app.use(bodyParser.json());
app.use('/sync', syncRouter);

app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    eventManager.addClient(res);
    

    req.on('close', () => {
        eventManager.removeClient(res);
    });
});

app.use(express.static(path.join(__dirname, 'src/public')))

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});