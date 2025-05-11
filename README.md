# Synchronization Server

This project implements a synchronization server using Node.js and Express. It utilizes the `DirectorySynchronizer` class to manage the publishing of initial content and updates, and employs Server-Sent Events (SSE) to redistribute data to multiple clients.

## Project Structure

```
synchronization-server
├── src
│   ├── DirectorySynchronizer.js      # Contains the DirectorySynchronizer class
│   ├── server.js                      # Entry point of the application
│   ├── routes
│   │   └── syncRoutes.js              # Defines routes for synchronization
│   └── utils
│       └── eventManager.js            # Manages SSE connections
├── package.json                       # npm configuration file
├── .env                               # Environment variables
└── README.md                          # Project documentation
```

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd synchronization-server
   ```

2. Install the dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory and configure your environment variables as needed.

## Usage

1. Start the server:
   ```
   npm start
   ```

2. The server will listen for incoming requests and manage SSE connections. You can publish initial content and updates through the defined routes.

## API Endpoints

- `POST /sync/publishInitial`: Publishes initial content to all connected clients.
- `POST /sync/publishUpdate`: Publishes updates to all connected clients.

## Contributing

Feel free to submit issues or pull requests for improvements or bug fixes.