export class DirectorySynchronizer {
    constructor() {
        
    }

    async publishInitial(content) {
        console.debug("Publishing initial content to server");
        fetch("/sync/initial", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ content })
        });
        
    }

    async publishUpdate(updates) {
        console.debug("Publishing updates to server");
        fetch("/sync/update", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ updates })
        });
    }

}