export class DirectorySynchronizer {
    constructor() {
        
    }

    async publishUpdate(content, isInitial = false) {
        console.debug(isInitial ? "Publishing initial content to server" : "Publishing update to server");
        fetch("/sync/update", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ content, isInitial })
        });
    }
}