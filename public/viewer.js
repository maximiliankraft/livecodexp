import { DirectoryRenderer } from "./observer.js";

class Logger {
    constructor(logContainerId) {
        this.logContainer = document.getElementById(logContainerId);
    }

    addLogMessage(message) {
        const logEntry = document.createElement("div");
        logEntry.className = "log-entry";
        logEntry.textContent = message;

        console.log(message);

        this.logContainer.appendChild(logEntry);

        // Ensure we only keep the last 10 log entries
        while (this.logContainer.children.length > 10) {
            this.logContainer.removeChild(this.logContainer.firstChild);
        }

        // Scroll to the bottom of the log
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }
}

class SSEClient {
    constructor(eventSourceUrl, renderer, logger) {
        this.eventSource = new EventSource(eventSourceUrl);
        console.log("Connecting to SSE server at", eventSourceUrl);
        
        this.renderer = renderer;
        this.logger = logger;
        this.currentContent = {}; // Store current content state
        this.previousContent = null; // Store previous content for comparison

        this.eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log(data);
            
            this.handleEvent(data);
        };

        this.eventSource.onerror = (error) => {
            console.error("SSE connection error:", error);
        };
    }

    findChangedFiles(oldContent, newContent) {
        const changes = [];
        
        // Function to compare objects recursively
        const compareContent = (oldObj, newObj, path = []) => {
            if (!oldObj) {
                // New directory or file added
                const newChanges = this.logNewContentAdded(newObj, path);
                changes.push(...newChanges);
                return;
            }
            
            // For all keys in newObj, check if they exist in oldObj
            for (const key in newObj) {
                const currentPath = [...path, key];
                const newItem = newObj[key];
                
                if (!oldObj[key]) {
                    // Item was created
                    changes.push({
                        path: currentPath.join('/'),
                        type: 'created',
                        kind: newItem.kind
                    });
                    continue;
                }
                
                const oldItem = oldObj[key];
                
                // If both are files, check if content changed
                if (newItem.kind === 'file' && oldItem.kind === 'file') {
                    if (newItem.data !== oldItem.data) {
                        changes.push({
                            path: currentPath.join('/'),
                            type: 'modified',
                            kind: 'file'
                        });
                    }
                } 
                // If both are directories, recurse
                else if (newItem.kind === 'directory' && oldItem.kind === 'directory') {
                    compareContent(oldItem.children, newItem.children, currentPath);
                }
                // If kinds are different, log as modified (rare case)
                else if (newItem.kind !== oldItem.kind) {
                    changes.push({
                        path: currentPath.join('/'),
                        type: 'modified',
                        kind: newItem.kind
                    });
                }
            }
            
            // Check for deleted items (in oldObj but not in newObj)
            for (const key in oldObj) {
                if (!newObj[key]) {
                    changes.push({
                        path: [...path, key].join('/'),
                        type: 'deleted',
                        kind: oldObj[key].kind
                    });
                }
            }
        };
        
        // Compare the content
        compareContent(oldContent, newContent);
        
        return changes;
    }

    logNewContentAdded(content, path) {
        const changes = [];
        
        for (const key in content) {
            const currentPath = [...path, key];
            const item = content[key];
            
            if (item.kind === 'file') {
                changes.push({
                    path: currentPath.join('/'),
                    type: 'created',
                    kind: 'file'
                });
            } else if (item.kind === 'directory') {
                // Log the directory itself
                changes.push({
                    path: currentPath.join('/'),
                    type: 'created',
                    kind: 'directory'
                });
                // Then recursively log its contents
                const childChanges = this.logNewContentAdded(item.children, currentPath);
                changes.push(...childChanges);
            }
        }
        
        return changes;
    }

    handleEvent(data) {
        if (data.type === "update") {
            console.debug(data.isInitial ? "Received initial content via SSE" : "Received update via SSE");
            
            // Capture currently viewed file name before updating content
            const currentlyViewedFile = this.renderer.currentlyViewedFile;
            
            // Check if this is not the initial content and we can detect changes
            if (!data.isInitial && this.previousContent) {
                const changes = this.findChangedFiles(this.previousContent, data.content);
                
                // Log each detected change
                changes.forEach(change => {
                    this.logger.addLogMessage(`${change.path} was ${change.type}`);
                });
            } else if (data.isInitial) {
                this.logger.addLogMessage("Initial content received");
            }
            
            // Store current content as previous for next comparison
            this.previousContent = JSON.parse(JSON.stringify(this.currentContent));
            
            // Replace content with the new full content
            this.currentContent = data.content;
            
            // Re-render with the updated content, preserving the currently viewed file
            this.renderer.renderDirectoryContent(this.currentContent, true);
            
            // If a file was being viewed, update it with the latest content
            if (currentlyViewedFile) {
                this.renderer.updateCurrentFileContent(this.currentContent, currentlyViewedFile);
            }
        }
    }
}

(async () => {
    const renderer = new DirectoryRenderer("contents", "#fileContent");
    const logger = new Logger("observer");

    // Initialize SSE client to listen for updates
    const sseClient = new SSEClient("/events", renderer, logger);

})();
