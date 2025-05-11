# Live Code Experience

This project implements a real-time code synchronization system for classroom and collaborative coding scenarios. It's designed to allow a teacher to share their code in real-time with students, enabling them to follow along with the teacher's coding process.

The system uses Node.js and Express to create a synchronization server, with the `DirectorySynchronizer` class managing the publishing of content and updates. It employs Server-Sent Events (SSE) to redistribute data to multiple clients in real-time. The system respects `.gitignore` rules to avoid sending unnecessary files.

## Key Features

- **Real-time File Synchronization**: Changes to files are immediately visible to all connected clients.
- **Live File Updates**: The currently viewed file is automatically updated when changes occur, without requiring the user to re-click on the file.
- **Tree View Navigation**: Easily navigate the directory structure to find and view files.
- **Syntax Highlighting**: Code is displayed with syntax highlighting for better readability.
- **File System Observer**: Using the File System API and FileSystemObserver, a selected directory is continuously monitored for changes.
- **Session Management**: Create and join separate coding sessions for different classes or topics.
- **Resource Limits**: Built-in limits for session count, file count, and size to ensure stability.
- **Windows XP Style UI**: Nostalgic and intuitive user interface with a Windows XP theme.

## Project Structure

```
live-code-experience
├── src
│   ├── public
│   │   ├── DirectorySynchronizer.js   # Handles synchronization with the server
│   │   ├── gitignore.js               # Handles .gitignore processing
│   │   ├── index.html                 # Landing page with session management
│   │   ├── observer.html              # Teacher's view (file sender)
│   │   ├── observer.js                # Main code for monitoring file changes
│   │   ├── style.css                  # Styling for the application
│   │   ├── viewer.html                # Student's view (file receiver)
│   │   └── viewer.js                  # Client-side code for receiving updates
│   ├── routes
│   │   └── syncRoutes.js              # Defines routes for synchronization
│   ├── services
│   │   └── sessionManager.js          # Handles session creation and management
│   └── server.js                      # Entry point of the application
├── Dockerfile                         # Docker container configuration
├── docker-compose.yml                 # Docker Compose setup for easy deployment
├── .env                               # Environment variables configuration
├── package.json                       # npm configuration file
└── README.md                          # Project documentation
```

## How It Works

1. **Session Management**:
   - Teachers create new sessions from the landing page.
   - Students join existing sessions using session IDs.
   - Each session is isolated, allowing multiple classes to run simultaneously.

2. **Teacher Side (Observer)**: 
   - The teacher selects a directory to share.
   - The FileSystemObserver monitors this directory for any changes.
   - When changes occur, they are sent to the server.
   - The observer interface shows the file structure and content.

3. **Server**: 
   - Receives updates from the teacher.
   - Manages connected clients (students) within each session.
   - Broadcasts updates to all connected clients in the same session via SSE.

4. **Student Side (Viewer)**:
   - Connects to the server via SSE within their session.
   - Receives real-time updates of the directory structure.
   - Views file content with automatic updates when files change.
   - The currently viewed file is automatically refreshed when its content changes.

## System Limitations

The system has the following built-in limitations to ensure stability:

- Maximum 5 concurrent sessions
- Maximum 500 files per session
- Maximum 5MB per file
- Maximum 50MB total size per session

## Installation

### Standard Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd live-code-experience
   ```

2. Install the dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with configuration (see `.env.example`).

4. Start the server:
   ```
   npm start
   ```

5. Access the application:
   - Main interface: `http://localhost:3000/`

### Docker Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd live-code-experience
   ```

2. Build and start using Docker Compose:
   ```
   docker-compose up -d
   ```

3. Access the application:
   - Main interface: `http://localhost:3000/`

## Usage

### For Teachers:
1. Open the main page and create a new session.
2. You'll be directed to the observer interface.
3. Click "Select directory" to choose the directory you want to share.
4. Navigate through your files in the left panel and edit them as needed.
5. All changes are automatically synchronized with students in your session.
6. The status bar shows file count and size information.

### For Students:
1. Open the main page and join an existing session using the session ID.
2. You'll be directed to the viewer interface.
3. The file structure and content shared by the teacher will appear automatically.
4. Click on files to view their content.
5. Any changes made by the teacher are automatically reflected in real-time.

## Security Considerations

- The application uses session-based authentication to ensure only authorized users can access sessions.
- Helmet.js is implemented to provide HTTP security headers.
- Rate limiting is enabled to prevent abuse.
- File size and count limits prevent resource exhaustion.
- Sessions automatically expire after 24 hours of inactivity.

## Deployment Considerations

When deploying to production, consider the following:

1. Change the `SESSION_SECRET` in the `.env` file.
2. Set `NODE_ENV=production` for optimized performance.
3. Use HTTPS in production environments.
4. Consider using a reverse proxy like Nginx to handle SSL termination.
5. Adjust resource limits as needed for your environment.

## Technical Details

- **Server-Sent Events (SSE)**: Used for one-way communication from server to clients.
- **File System API**: Used to access and monitor the local file system.
- **FileSystemObserver API**: Used to detect changes in the monitored directory.
- **Express.js**: Provides the server framework.
- **Docker**: Container-based deployment for easy setup.

## License Information

This project is licensed under the ISC License.

## Libraries and Attributions

- **Express**: MIT License - Copyright (c) 2009-2022 TJ Holowaychuk, Hage Yaapa, Douglas Christopher Wilson
- **xp.css**: MIT License - Copyright (c) 2020 Adam Hammad
- **Highlight.js**: BSD 3-Clause License - Copyright (c) 2006, Ivan Sagalaev
- **nanoid**: MIT License - Copyright (c) 2017 Andrey Sitnik
- **helmet**: MIT License - Copyright (c) 2012-2023 Evan Hahn, Adam Baldwin
- **uuid**: MIT License - Copyright (c) 2010-2020 Robert Kieffer

## Contributors

- Max (Project Creator)
- Claude (Developer)

## Contributing

Feel free to submit issues or pull requests for improvements or bug fixes.