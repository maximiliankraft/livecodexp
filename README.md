# Live Code Experience

This project implements a real-time code synchronization system for classroom and collaborative coding scenarios. It's designed to allow a teacher to share their code in real-time with students, enabling them to follow along with the teacher's coding process.

The system uses Node.js and Express to create a synchronization server, with the `DirectorySynchronizer` class managing the publishing of content and updates. It employs Server-Sent Events (SSE) to redistribute data to multiple clients in real-time. The system respects `.gitignore` rules to avoid sending unnecessary files.

## Key Features

- **Real-time File Synchronization**: Changes to files are immediately visible to all connected clients.
- **Live File Updates**: The currently viewed file is automatically updated when changes occur, without requiring the user to re-click on the file.
- **Tree View Navigation**: Easily navigate the directory structure to find and view files.
- **Syntax Highlighting**: Code is displayed with syntax highlighting for better readability.
- **File System Observer**: Using the File System API and FileSystemObserver, a selected directory is continuously monitored for changes.

## Project Structure

```
live-code-experience
├── src
│   ├── public
│   │   ├── DirectorySynchronizer.js   # Handles synchronization with the server
│   │   ├── gitignore.js               # Handles .gitignore processing
│   │   ├── observer.html              # Teacher's view (file sender)
│   │   ├── observer.js                # Main code for monitoring file changes
│   │   ├── style.css                  # Styling for the application
│   │   ├── viewer.html                # Student's view (file receiver)
│   │   └── viewer.js                  # Client-side code for receiving updates
│   ├── routes
│   │   └── syncRoutes.js              # Defines routes for synchronization
│   └── server.js                      # Entry point of the application
├── package.json                       # npm configuration file
└── README.md                          # Project documentation
```

## How It Works

1. **Teacher Side (Observer)**: 
   - The teacher selects a directory to share.
   - The FileSystemObserver monitors this directory for any changes.
   - When changes occur, they are sent to the server.
   - The observer interface shows the file structure and content.

2. **Server**: 
   - Receives updates from the teacher.
   - Manages connected clients (students).
   - Broadcasts updates to all connected clients via SSE.

3. **Student Side (Viewer)**:
   - Connects to the server via SSE.
   - Receives real-time updates of the directory structure.
   - Views file content with automatic updates when files change.
   - The currently viewed file is automatically refreshed when its content changes.

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd live-code-experience
   ```

2. Install the dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   npm start
   ```

4. Access the application:
   - Teacher interface: `http://localhost:3000/observer.html`
   - Student interface: `http://localhost:3000/viewer.html`

## Usage

### For Teachers:
1. Open the observer.html page.
2. Click "Select directory" to choose the directory you want to share.
3. Navigate through your files in the left panel and edit them as needed.
4. All changes are automatically synchronized with students.

### For Students:
1. Open the viewer.html page.
2. The file structure and content shared by the teacher will appear automatically.
3. Click on files to view their content.
4. Any changes made by the teacher are automatically reflected in real-time.

## Technical Details

- **Server-Sent Events (SSE)**: Used for one-way communication from server to clients.
- **File System API**: Used to access and monitor the local file system.
- **FileSystemObserver API**: Used to detect changes in the monitored directory.
- **Express.js**: Provides the server framework.

## Contributing

Feel free to submit issues or pull requests for improvements or bug fixes.