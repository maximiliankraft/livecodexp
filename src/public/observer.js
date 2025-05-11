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
    }

    renderDirectoryContent(content) {
        this.contentList.innerHTML = ""; // Clear previous content

        const createTreeView = (content) => {
            const ul = document.createElement("ul");
            ul.className = "tree-view";

            for (const [name, value] of Object.entries(content)) {
                const li = document.createElement("li");

                if (value.kind === "file") {
                    li.textContent = name;
                    li.className = "file";
                    li.data = value.data; // Attach file content to the list item
                    li.onclick = (e) => this.onFileClick(e, name);
                } else if (value.kind === "directory") {
                    const details = document.createElement("details");
                    const summary = document.createElement("summary");
                    summary.textContent = name;

                    details.appendChild(summary);
                    details.appendChild(createTreeView(value.children));
                    li.appendChild(details);
                }

                ul.appendChild(li);
            }

            return ul;
        };

        const treeView = createTreeView(content);
        this.contentList.appendChild(treeView);

        // Update the currently viewed file content if it has changed
        if (this.currentlyViewedFile && content[this.currentlyViewedFile]) {
            const updatedFile = content[this.currentlyViewedFile];
            if (updatedFile.kind === "file") {
                this.fileContentContainer.textContent = updatedFile.data;
            }
        }
    }

    async onFileClick(e, fileName) {
        this.currentlyViewedFile = fileName; // Store the name of the currently viewed file
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

            const filePath = record.relativePathComponents.join("/");

            if (
                    filePath.endsWith(".crswap") || 
                    filePath.endsWith("~") || 
                    await isIgnoredByGitignore(this.dataManager.gitignoreFile, this.dataManager.gitignoreDir, filePath)
                ) {
                continue;
            }
            console.log(record);
            
                updates.push(record);
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
            renderer.renderDirectoryContent(content); // Initial load
            synchronizer.publishInitial(content); // Send updates to API
        } else {
            synchronizer.publishUpdate(updates); // Send updates to API
            renderer.renderDirectoryContent(content); // Update UI (can be optimized further)
        }
    });

    document.querySelector("#selectDirButton").onclick = async () => {
        const rootHandle = await window.showDirectoryPicker({ mode: "read" });
        await observerManager.startObserver(rootHandle);
    };
})();