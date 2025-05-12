import { DirectorySynchronizer } from './DirectorySynchronizer.js';
import isIgnoredByGitignore from './gitignore.js';

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

class DirectoryDataManager {
    constructor() {
        this.gitignoreFile = null;
        this.gitignoreDir = null;
    }

    async findGitignoreFile(rootHandle) {
        for await (const entry of rootHandle.values()) {
            if (entry.kind === "file" && entry.name === ".gitignore") {
                this.gitignoreFile = await entry.getFile();
                this.gitignoreDir = rootHandle.name;
                break;
            }
        }
    }

    async getDirectoryContent(rootHandle) {
        if (!this.gitignoreFile) {
            await this.findGitignoreFile(rootHandle);
        }

        const content = {};
        for await (const entry of rootHandle.values()) {
            const filePath = `${rootHandle.name}/${entry.name}`;
            if (await isIgnoredByGitignore(this.gitignoreFile, this.gitignoreDir, filePath)) {
                continue; // Skip ignored files or directories
            }

            if (entry.kind === "file") {
                const file = await entry.getFile();
                const fileContent = await file.text(); // Read the file content
                content[entry.name] = { kind: "file", data: fileContent }; // Add file content
            } else if (entry.kind === "directory") {
                content[entry.name] = {
                    kind: "directory",
                    handle: entry,
                    children: await this.getDirectoryContent(entry),
                };
            }
        }
        return content;
    }
}

export class DirectoryRenderer {
    constructor(contentContainerId, fileContentContainerId) {
        this.contentList = document.getElementById(contentContainerId);
        this.fileContentContainer = document.querySelector(fileContentContainerId);
        this.currentlyViewedFile = null; // Track the currently displayed file
        this.filePathInTree = null; // Track the path of the file in the tree structure
    }

    renderDirectoryContent(content, preserveSelection = false) {
        // Save the currently expanded state of folders if preserving selection
        const expandedFolders = new Set();
        if (preserveSelection) {
            document.querySelectorAll('#contents details[open]').forEach(detail => {
                const folderName = detail.querySelector('summary').textContent;
                expandedFolders.add(folderName);
            });
        }

        this.contentList.innerHTML = ""; // Clear previous content

        const createTreeView = (content, path = []) => {
            const ul = document.createElement("ul");
            ul.className = "tree-view";

            for (const [name, value] of Object.entries(content)) {
                const li = document.createElement("li");
                const currentPath = [...path, name];

                if (value.kind === "file") {
                    li.textContent = name;
                    li.className = "file";
                    li.dataset.path = currentPath.join('/');
                    li.data = value.data; // Attach file content to the list item
                    
                    // Check if this is the currently viewed file
                    const isCurrentFile = this.currentlyViewedFile === name && path.length === 0;
                    if (isCurrentFile) {
                        li.classList.add('active-file');
                    }
                    
                    li.onclick = (e) => this.onFileClick(e, name, currentPath);
                } else if (value.kind === "directory") {
                    const details = document.createElement("details");
                    const summary = document.createElement("summary");
                    summary.textContent = name;
                    
                    // If we're preserving selection, restore expanded state
                    if (preserveSelection && expandedFolders.has(name)) {
                        details.open = true;
                    }

                    details.appendChild(summary);
                    details.appendChild(createTreeView(value.children, currentPath));
                    li.appendChild(details);
                }

                ul.appendChild(li);
            }

            return ul;
        };

        const treeView = createTreeView(content);
        this.contentList.appendChild(treeView);

        // After rendering the tree, if we have a currently viewed file, update its content
        if (this.currentlyViewedFile) {
            this.updateCurrentFileContent(content, this.currentlyViewedFile);
        }
    }

    // Find and update a file in the content hierarchy based on its path
    findFileInContent(content, filePath) {
        if (!filePath || filePath.length === 0) {
            return null;
        }

        if (filePath.length === 1) {
            // Direct child of the current level
            const fileName = filePath[0];
            return content[fileName];
        }

        // Navigate through the directory structure
        const dirName = filePath[0];
        const dir = content[dirName];
        
        if (dir && dir.kind === "directory" && dir.children) {
            return this.findFileInContent(dir.children, filePath.slice(1));
        }
        
        return null;
    }

    // Update the content of the currently viewed file
    updateCurrentFileContent(content, fileName) {
        let fileContent = null;
        
        // If we have a path in the tree structure
        if (this.filePathInTree && this.filePathInTree.length > 0) {
            const fileObj = this.findFileInContent(content, this.filePathInTree);
            if (fileObj && fileObj.kind === "file" && fileObj.data) {
                fileContent = fileObj.data;
            }
        } 
        // Fallback to root level files
        else if (content[fileName] && content[fileName].kind === "file") {
            fileContent = content[fileName].data;
        }

        // Update the file content if we found it
        if (fileContent) {
            this.fileContentContainer.textContent = fileContent;
            this.fileContentContainer.innerHTML = hljs.highlightAuto(fileContent).value;
        }
    }

    async onFileClick(e, fileName, filePath) {
        this.currentlyViewedFile = fileName; // Store the name of the currently viewed file
        this.filePathInTree = filePath; // Store the path to the file
        
        // Remove any existing active file highlight
        document.querySelectorAll('.active-file').forEach(el => {
            el.classList.remove('active-file');
        });
        
        // Add active class to the clicked file
        e.target.classList.add('active-file');
        
        const text = e.target.data;

        // Set the file content and apply syntax highlighting
        this.fileContentContainer.textContent = text;
        this.fileContentContainer.innerHTML = hljs.highlightAuto(text).value; // Set highlighted content
    }
}

class FileSystemObserverManager {
    constructor(logger, dataManager, onUpdate) {
        this.logger = logger;
        this.dataManager = dataManager;
        this.onUpdate = onUpdate; // Callback to handle updates (e.g., render or send to API)
    }

    async callback(records, observer, rootHandle) {
        if (records.length === 0) return;
            
        // Object to store just the changed files
        const changedFiles = {};
        
        for (const record of records) {
            const filePathStr = record.relativePathComponents.join("/");

            if (
                filePathStr.endsWith(".crswap") || 
                filePathStr.endsWith("~") || 
                await isIgnoredByGitignore(this.dataManager.gitignoreFile, this.dataManager.gitignoreDir, filePathStr)
            ) {
                continue;
            }
            
            // Log the change
            this.logger.addLogMessage(
                ` ${filePathStr} ${
                    ["modified", "deleted", "created", "disappeared"].includes(record.type) ? "was " : ""
                } ${record.type}`
            );
            
            // Extract specific file content
            if (record.type === "deleted") {
                // For deleted files, just mark them as deleted
                changedFiles[filePathStr] = { 
                    kind: "deleted", 
                    wasKind: "file" // Assume file, but could be directory
                };
            } else if (record.target && (record.type === "created" || record.type === "modified")) {
                // For new or modified files, get their content
                if (record.target.kind === "file") {
                    try {
                        const file = await record.target.getFile();
                        const fileContent = await file.text();
                        changedFiles[filePathStr] = {
                            kind: "file",
                            data: fileContent,
                            type: record.type
                        };
                    } catch (e) {
                        console.error(`Error getting content for ${filePathStr}:`, e);
                        // Still include the file in changes, just without content
                        changedFiles[filePathStr] = {
                            kind: "file",
                            type: record.type,
                            error: "Failed to read content"
                        };
                    }
                } else if (record.target.kind === "directory") {
                    // For directories, mark as directory but don't include children
                    // We'll need to separately handle directory structure if this matters
                    changedFiles[filePathStr] = {
                        kind: "directory",
                        type: record.type
                    };
                }
            }
        }
        
        // Get the full current content for the UI rendering
        const updatedContent = await this.dataManager.getDirectoryContent(rootHandle);
        
        // Pass both the full content (for UI) and changed files (for sync) to callback
        this.onUpdate(changedFiles, updatedContent);
    }

    async startObservation(rootHandle) {
        const observer = new self.FileSystemObserver((r, o) => this.callback(r, o, rootHandle));
        await observer.observe(rootHandle, { recursive: true });
    }

    async startObserver(rootHandle) {
        if ("FileSystemObserver" in self) {
            const initialContent = await this.dataManager.getDirectoryContent(rootHandle);
            this.onUpdate([], initialContent); // Send initial state
            await this.startObservation(rootHandle);
        } else {
            document.querySelector("pre").textContent = "😕 Your browser does not support the File System Observer API";
        }
    }
}

(async () => {
    const logger = new Logger("observer");
    const dataManager = new DirectoryDataManager();
    const renderer = new DirectoryRenderer("contents", "#fileContent");
    const synchronizer = new DirectorySynchronizer();

    // Set up error handling for the synchronizer
    synchronizer.setErrorCallback((errorMessage) => {
        // Update the status bar with the error
        const statusElement = document.getElementById('status-message');
        if (statusElement) {
            statusElement.textContent = errorMessage;
            statusElement.style.color = 'red';
            
            // Reset after 5 seconds
            setTimeout(() => {
                statusElement.textContent = "Ready";
                statusElement.style.color = 'black';
            }, 5000);
        }
        
        // Also log to the observer log
        logger.addLogMessage(`Error: ${errorMessage}`);
    });

    const observerManager = new FileSystemObserverManager(logger, dataManager, async (changedFiles, content) => {
        // Handle updates: render or send to API
        const isInitialLoad = Object.keys(changedFiles).length === 0;
        
        if (isInitialLoad) {
            // Initial load - send full content
            renderer.renderDirectoryContent(content);
            
            // Check if user is in a session before publishing
            try {
                const response = await fetch('/api/sessions/current');
                const data = await response.json();
                
                if (data.inSession && data.isOwner) {
                    // Update status
                    const statusElement = document.getElementById('status-message');
                    if (statusElement) {
                        statusElement.textContent = "Publishing initial content...";
                    }
                    
                    // Publish initial content
                    const success = await synchronizer.publishUpdate(content, true);
                    
                    if (success && statusElement) {
                        statusElement.textContent = "Initial content published";
                        statusElement.style.color = 'green';
                        
                        setTimeout(() => {
                            statusElement.textContent = "Ready";
                            statusElement.style.color = 'black';
                        }, 2000);
                    }
                } else {
                    logger.addLogMessage("Not publishing: user is not in a session or not the owner");
                }
            } catch (error) {
                console.error("Error checking session:", error);
                logger.addLogMessage(`Session error: ${error.message}`);
            }
        } else {
            // Regular update with changes - only send the changed files
            renderer.renderDirectoryContent(content, true); // Preserve currently selected file
            
            // Update status
            const statusElement = document.getElementById('status-message');
            if (statusElement) {
                statusElement.textContent = "Publishing update...";
            }
            
            const changedFilesCount = Object.keys(changedFiles).length;
            logger.addLogMessage(`Publishing update with ${changedFilesCount} changed file(s)`);
            
            // Publish only the changed files
            const success = await synchronizer.publishUpdate(content, false, changedFiles);
            
            if (success && statusElement) {
                statusElement.textContent = `Update published (${changedFilesCount} file(s))`;
                statusElement.style.color = 'green';
                
                setTimeout(() => {
                    statusElement.textContent = "Ready";
                    statusElement.style.color = 'black';
                }, 2000);
            }
        }
        
        // Update session stats after publishing
        if (!isInitialLoad) {
            try {
                await fetch('/sync/stats');
            } catch (error) {
                console.error("Error updating session stats:", error);
            }
        }
    });

    const selectDirButton = document.querySelector("#selectDirButton");
    
    if (selectDirButton) {selectDirButton.onclick = async () => {
        try {
            // Check if user is in a session and is the owner
            const response = await fetch('/api/sessions/current');
            const data = await response.json();
            
            if (!data.inSession) {
                alert("You need to create or join a session first.");
                window.location.href = '/';
                return;
            }
            
            if (!data.isOwner) {
                alert("Only the session owner can share files.");
                return;
            }
            
            // If checks pass, proceed with directory selection
            const rootHandle = await window.showDirectoryPicker({ mode: "read" });
            
            // Update status
            const statusElement = document.getElementById('status-message');
            if (statusElement) {
                statusElement.textContent = "Initializing directory observer...";
            }
            
            await observerManager.startObserver(rootHandle);
            
            if (statusElement) {
                statusElement.textContent = "Directory observation started";
                statusElement.style.color = 'green';
                
                setTimeout(() => {
                    statusElement.textContent = "Ready";
                    statusElement.style.color = 'black';
                }, 2000);
            }
        } catch (error) {
            console.error("Error selecting directory:", error);
            logger.addLogMessage(`Error: ${error.message}`);
            
            const statusElement = document.getElementById('status-message');
            if (statusElement) {
                statusElement.textContent = `Error: ${error.message}`;
                statusElement.style.color = 'red';
            }
        }
    };}
})();