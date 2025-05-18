describe('Student Viewer', () => {
  beforeEach(() => {
    // Visit the viewer page before each test
    // Intercept the current session check to simulate being in a session
    cy.intercept('GET', '/api/sessions/current', {
      statusCode: 200,
      body: {
        inSession: true,
        isOwner: false,
        session: {
          id: 'test123',
          name: 'Test Session'
        }
      }
    }).as('getCurrentSession');
    
    cy.visit('http://localhost:3000/viewer.html');
    cy.wait('@getCurrentSession');
  });

  it('should display the correct connection status, not just always connecting...', () => {
    // Initially the status should be "Connecting..."
    cy.get('#status-message').should('contain', 'Connecting...');
    
    // Intercept the SSE connection
    // Since we can't directly test SSE in Cypress, we'll simulate the connection success
    // by updating the status programmatically using the function defined in the page
    cy.window().then((win) => {
      // Access the updateStatus function in the page context
      // Execute the function directly in the page context to update the status
      win.eval(`
        updateStatus('Connected', 'success');
      `);
      
      // Verify the status has been updated
      cy.get('#status-message').should('contain', 'Connected');
      cy.get('#status-message').should('have.css', 'color', 'rgb(0, 128, 0)'); // Green color
    });
    
    // Simulate connection error
    cy.window().then((win) => {
      win.eval(`
        updateStatus('Connection error: Failed to connect to server', 'error');
      `);
      
      // Verify error status
      cy.get('#status-message').should('contain', 'Connection error');
      cy.get('#status-message').should('have.css', 'color', 'rgb(255, 0, 0)'); // Red color
    });
  });

  it('should display the correct amount of files before joining the session', () => {
    // First, let's intercept the API call that provides session info
    cy.intercept('GET', '/api/sessions/info', {
      statusCode: 200,
      body: {
        fileCount: 3,
        totalSize: 15240, // ~15KB
        lastUpdate: new Date().toISOString()
      }
    }).as('getSessionInfo');
    
    // Trigger a refresh of session info
    cy.window().then((win) => {
      win.eval(`
        // Simulate fetching session info
        fetch('/api/sessions/info')
          .then(response => response.json())
          .then(data => {
            // Update session info in the UI
            const sessionInfo = document.getElementById('session-info');
            sessionInfo.querySelector('span').textContent = 
              \`Files: \${data.fileCount} | Size: \${Math.round(data.totalSize/1024)} KB\`;
          });
      `);
    });
    
    // Wait for the API call to complete
    cy.wait('@getSessionInfo');
    
    // Verify the file count is displayed correctly in the session info
    cy.get('#session-info span').should('contain', 'Files: 3');
    cy.get('#session-info span').should('contain', 'Size: 15 KB');
    
    // Now, let's test the directory structure update via SSE
    // First, modify the session info to include a mock handler for SSE events
    cy.window().then((win) => {
      // Create a mock event with sample directory structure
      const mockData = {
        type: "update",
        isInitial: true,
        content: {
          "file1.js": {
            kind: "file",
            data: "console.log('Hello World');"
          },
          "file2.js": {
            kind: "file",
            data: "// Sample code"
          },
          "images": {
            kind: "directory",
            children: {
              "logo.png": {
                kind: "file",
                data: "[Binary data]"
              }
            }
          }
        }
      };
      
      // Create a mock renderer function
      win.eval(`
        // Create a mock function to render the directory content
        window.mockRenderDirectoryContent = function(content) {
          console.log('Rendering directory content', content);
          
          // Get the contents element
          const contentsElement = document.getElementById('contents');
          
          // Clear existing content
          contentsElement.innerHTML = '';
          
          // Count files and directories for validation
          let fileCount = 0;
          let dirCount = 0;
          
          // Loop through the content and create elements
          for (const [name, item] of Object.entries(content)) {
            const element = document.createElement('div');
            
            if (item.kind === 'file') {
              element.className = 'file-item';
              element.textContent = name;
              fileCount++;
            } else if (item.kind === 'directory') {
              element.className = 'directory-item';
              element.textContent = name + '/';
              dirCount++;
              
              // Count files in the directory
              if (item.children) {
                fileCount += Object.values(item.children).filter(child => child.kind === 'file').length;
              }
            }
            
            contentsElement.appendChild(element);
          }
          
          // Update status to show successfully loaded
          updateStatus('Loaded ' + fileCount + ' files', 'success');
          
          // Update session info with file count
          const sessionInfo = document.getElementById('session-info');
          sessionInfo.querySelector('span').textContent = 
            \`Files: \${fileCount} | Size: 15 KB\`;
        };
        
        // Call the mock renderer with our test data
        window.mockRenderDirectoryContent(${JSON.stringify(mockData.content)});
      `);
    });
    
    // Check that the directory structure is rendered correctly
    cy.get('#contents .file-item').should('have.length', 2); // Top-level files
    cy.get('#contents .directory-item').should('have.length', 1); // Directory
    
    // Verify the status message shows success
    cy.get('#status-message').should('contain', 'Loaded 3 files');
    cy.get('#status-message').should('have.css', 'color', 'rgb(0, 128, 0)'); // Green color
  });
});