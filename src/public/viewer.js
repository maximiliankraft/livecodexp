import { DirectoryRenderer } from "./observer.js";

class SSEClient {
    constructor(eventSourceUrl, renderer) {
        this.eventSource = new EventSource(eventSourceUrl);
        console.log("Connecting to SSE server at", eventSourceUrl);
        
        this.renderer = renderer;
        this.currentContent = {}; // Store current content state

        this.eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log(data);
            
            this.handleEvent(data);
        };

        this.eventSource.onerror = (error) => {
            console.error("SSE connection error:", error);
        };
    }

    handleEvent(data) {
        if (data.type === "initial") {
            console.debug("Received initial content via SSE");
            this.currentContent = data.content; // Store initial state
            this.renderer.renderDirectoryContent(this.currentContent);
        } else if (data.type === "update") {
            console.debug("Received updates via SSE");
            
            // Apply each update to the current content state
            data.updates.forEach(update => {
                this.mergeUpdate(update);
            });
            
            // Re-render with the updated content
            this.renderer.renderDirectoryContent(this.currentContent);
        }
    }
    
    // Recursively merge updates into the current content
    mergeUpdate(update, target = this.currentContent) {
        for (const [key, value] of Object.entries(update)) {
            if (value.kind === "file") {
                // Direct file update
                target[key] = value;
            } else if (value.kind === "directory") {
                // Handle directory updates (nested structure)
                if (!target[key]) {
                    // New directory
                    target[key] = {
                        kind: "directory",
                        children: {}
                    };
                } else if (!target[key].children) {
                    // Ensure existing directory has children object
                    target[key].children = {};
                }
                
                // Recursive update for nested children
                if (value.children) {
                    // Pass the correct target object for recursive merging
                    this.mergeUpdate(value.children, target[key].children);
                }
            }
        }
    }
}

(async () => {
    const renderer = new DirectoryRenderer("contents", "#fileContent");

    // Initialize SSE client to listen for updates
    const sseClient = new SSEClient("/events", renderer);

    document.querySelector("#selectDirButton").onclick = async () => {
        alert("Directory selection is now handled by the server. Updates will appear automatically.");
    };
})();
