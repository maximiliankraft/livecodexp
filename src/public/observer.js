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
        const updates = [];
        for (const record of records) {

            const filePathStr = record.relativePathComponents.join("/");

            if (
                filePathStr.endsWith(".crswap") || 
                filePathStr.endsWith("~") || 
                    await isIgnoredByGitignore(this.dataManager.gitignoreFile, this.dataManager.gitignoreDir, filePathStr)
                ) {
                continue;
            }
            console.log(record);
            
                // Format the update in the required structure
                const filePathArr = record.relativePathComponents;
                if (filePathArr.length > 0) {
                    // Get the filename from the last part of the path
                    const filename = filePathArr[filePathArr.length - 1];
                    // Get the full path excluding the filename
                    const subfolderPath = filePathArr.slice(0, -1);
                    
                    // Handle different folder depth cases
                    let updateObj = {};
                    
                    if (subfolderPath.length === 0) {
                        // File is in the root directory
                        // For files that are not deleted, we need to get content
                        if (record.type !== "deleted" && record.target && record.target.kind === "file") {
                            // Try to get file content for the update
                            try {
                                // Async won't work in this context, so we just set type and get content later if needed
                                updateObj[filename] = { 
                                    kind: "file", 
                                    type: record.type
                                };
                            } catch (e) {
                                console.error("Error getting file content:", e);
                                updateObj[filename] = { 
                                    kind: "file", 
                                    type: record.type
                                };
                            }
                        } else {
                            updateObj[filename] = { 
                                kind: "file", 
                                type: record.type
                            };
                        }
                    } else {
                        // File is in a subfolder - build nested structure
                        let currentLevel = updateObj;
                        subfolderPath.forEach((folder, index) => {
                            if (index === subfolderPath.length - 1) {
                                // Last folder level - add the file here
                                let fileData = { 
                                    kind: "file", 
                                    type: record.type
                                };
                                
                                // For files that are not deleted, try to get content
                                if (record.type !== "deleted" && record.target && record.target.kind === "file") {
                                    // Async won't work here, just set type
                                    fileData = { 
                                        kind: "file", 
                                        type: record.type
                                    };
                                }
                                
                                currentLevel[folder] = {
                                    kind: "directory",
                                    children: {
                                        [filename]: fileData
                                    }
                                };
                            } else {
                                // Intermediate folder level
                                currentLevel[folder] = {
                                    kind: "directory",
                                    children: {}
                                };
                                currentLevel = currentLevel[folder].children;
                            }
                        });
                    }
                    
                    updates.push(updateObj);
                }
                
                this.logger.addLogMessage(
                    ` ${record.relativePathComponents.join("/")} ${
                        ["modified", "deleted", "created", "disappeared"].includes(record.type) ? "was " : ""
                    } ${record.type}`
                );
        }

        if (updates.length > 0) {
            const updatedContent = await this.dataManager.getDirectoryContent(rootHandle);
            this.onUpdate(updates, updatedContent); // Notify about updates
        }
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

    const observerManager = new FileSystemObserverManager(logger, dataManager, (updates, content) => {
        // Handle updates: render or send to API
        
        if (updates.length === 0) {
            // Initial load - send full content
            renderer.renderDirectoryContent(content);
            synchronizer.publishUpdate(content, true); // Send as initial content
        } else {
            // Regular update with changes
            synchronizer.publishUpdate(content, false); // Send full updated content
            renderer.renderDirectoryContent(content, true); // Preserve currently selected file
        }
    });

    document.querySelector("#selectDirButton").onclick = async () => {
        const rootHandle = await window.showDirectoryPicker({ mode: "read" });
        await observerManager.startObserver(rootHandle);
    };
})();