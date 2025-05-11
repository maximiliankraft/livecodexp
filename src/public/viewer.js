import { DirectoryRenderer } from "./observer.js";

class SSEClient {
    constructor(eventSourceUrl, renderer) {
        this.eventSource = new EventSource(eventSourceUrl);
        console.log("Connecting to SSE server at", eventSourceUrl);
        
        this.renderer = renderer;

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
            this.renderer.renderDirectoryContent(data.content);
        } else if (data.type === "update") {
            console.debug("Received updates via SSE");
            // Handle updates if necessary (e.g., merge updates into the current content)
            this.renderer.renderDirectoryContent(data.updates);
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

/*(async () => {
    const logger = new Logger("observer");
    const dataManager = new DirectoryDataManager();
    const renderer = new DirectoryRenderer("contents", "#fileContent");
    const synchronizer = new DirectorySynchronizer();

    const observerManager = new FileSystemObserverManager(logger, dataManager, (updates, content) => {
        // Handle updates: render or send to API
        
        if (updates.length === 0) {
            renderer.renderDirectoryContent(content); // Initial load
            synchronizer.publishUpdate(updates); // Send updates to API
        } else {
            synchronizer.publishInitial(content); // Send updates to API
            renderer.renderDirectoryContent(content); // Update UI (can be optimized further)
        }
    });

    document.querySelector("#selectDirButton").onclick = async () => {
        const rootHandle = await window.showDirectoryPicker({ mode: "read" });
        await observerManager.startObserver(rootHandle);
    };
})();*/