export class DirectorySynchronizer {
    constructor() {
        this.errorCallback = null;
    }

    setErrorCallback(callback) {
        this.errorCallback = callback;
    }

    async publishUpdate(content, isInitial = false, changedFiles = null) {
        console.debug(isInitial ? "Publishing initial content to server" : "Publishing update to server");
        try {
            let payload;
            
            if (isInitial) {
                // For initial sync, send the full content
                payload = { content, isInitial: true };
            } else if (changedFiles && Object.keys(changedFiles).length > 0) {
                // For updates, only send the changed files
                payload = { changes: changedFiles, isInitial: false };
            } else {
                console.debug("No changes to publish");
                return true;
            }
            
            const response = await fetch("/sync/update", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error publishing update:", errorData);
                
                if (this.errorCallback) {
                    this.errorCallback(errorData.error || "Failed to publish update");
                }
                
                return false;
            }
            
            return true;
        } catch (error) {
            console.error("Error publishing update:", error);
            
            if (this.errorCallback) {
                this.errorCallback("Network error: " + error.message);
            }
            
            return false;
        }
    }
}