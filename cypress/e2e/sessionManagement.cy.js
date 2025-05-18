// Session management tests for Live Code Experience
describe('Session Management', () => {
  beforeEach(() => {
    // Visit the application homepage before each test
    cy.visit('http://localhost:3000');
    
    // Clear any cookies/local storage to ensure clean state
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  it('should display the session management window', () => {
    // Verify that the session management window is displayed
    cy.get('.window .title-bar-text').should('contain', 'Session Management');
    
    // Verify the tabs exist
    cy.get('[role="tab"]').should('have.length', 2);
    cy.get('[role="tab"]').first().should('contain', 'Create Session');
    cy.get('[role="tab"]').last().should('contain', 'Join Session');
    
    // Verify the create session form is visible by default
    cy.get('#create-session-tab').should('be.visible');
    cy.get('#join-session-tab').should('not.be.visible');
  });

  it('should allow tab switching', () => {
    // Check that create session tab is visible by default
    cy.get('#create-session-tab').should('be.visible');
    cy.get('#join-session-tab').should('not.be.visible');
    
    // Click on join session tab
    cy.get('[role="tab"]').last().click();
    
    // Check that join session tab is now visible
    cy.get('#create-session-tab').should('not.be.visible');
    cy.get('#join-session-tab').should('be.visible');
    
    // Click back to create session tab
    cy.get('[role="tab"]').first().click();
    
    // Check that create session tab is visible again
    cy.get('#create-session-tab').should('be.visible');
    cy.get('#join-session-tab').should('not.be.visible');
  });

  it('should display session creation validation', () => {
    // Try to submit the form without a session name
    cy.get('#session-name').clear();
    cy.get('#create-session-form button[type="submit"]').click();
    
    // Check that the status message shows an error
    cy.get('#status-message').should('contain', 'Please enter a session name')
                           .should('have.css', 'color', 'rgb(255, 0, 0)');
  });

  it('should load available sessions', () => {
    // Intercept API call to get sessions
    cy.intercept('GET', '/api/sessions', {
      statusCode: 200,
      body: [
        { 
          id: 'test123', 
          name: 'Test Session', 
          fileCount: 5 
        },
        { 
          id: 'demo456', 
          name: 'Demo Session', 
          fileCount: 10 
        }
      ]
    }).as('getSessions');
    
    // Go to join session tab
    cy.get('[role="tab"]').last().click();
    
    // Check for the loading message
    cy.get('#session-list').should('contain', 'Loading sessions');
    
    // Wait for the API call to complete
    cy.wait('@getSessions');
    
    // Check that sessions are displayed
    cy.get('#session-list .session-item').should('have.length', 2);
    cy.get('#session-list .session-item').first().should('contain', 'Test Session (Files: 5)');
    cy.get('#session-list .session-item').last().should('contain', 'Demo Session (Files: 10)');
    
    // Check active sessions count
    cy.get('#active-sessions').should('contain', '2');
  });

  it('should handle empty sessions list', () => {
    // Intercept API call to get sessions with empty array
    cy.intercept('GET', '/api/sessions', {
      statusCode: 200,
      body: []
    }).as('getEmptySessions');
    
    // Go to join session tab
    cy.get('[role="tab"]').last().click();
    
    // Wait for the API call to complete
    cy.wait('@getEmptySessions');
    
    // Check that "no sessions" message is displayed
    cy.get('#session-list').should('contain', 'No active sessions available');
    
    // Check active sessions count
    cy.get('#active-sessions').should('contain', '0');
  });

  it('should allow selecting a session from the list', () => {
    // Intercept API call to get sessions
    cy.intercept('GET', '/api/sessions', {
      statusCode: 200,
      body: [
        { 
          id: 'test123', 
          name: 'Test Session', 
          fileCount: 5 
        }
      ]
    }).as('getSessions');
    
    // Go to join session tab
    cy.get('[role="tab"]').last().click();
    
    // Wait for the API call to complete
    cy.wait('@getSessions');
    
    // Click on the session
    cy.get('#session-list .session-item').click();
    
    // Check that the session is selected
    cy.get('#session-list .session-item').should('have.class', 'selected');
    
    // Check that the session ID is filled in
    cy.get('#session-id').should('have.value', 'test123');
  });

  it('should show error when joining without a session ID', () => {
    // Go to join session tab
    cy.get('[role="tab"]').last().click();
    
    // Try to join without a session ID
    cy.get('#join-btn').click();
    
    // Check that the status message shows an error
    cy.get('#status-message').should('contain', 'Please enter a session ID')
                           .should('have.css', 'color', 'rgb(255, 0, 0)');
  });

  it('should handle session creation success', () => {
    // Intercept API call to create session
    cy.intercept('POST', '/api/sessions', {
      statusCode: 200,
      body: { 
        id: 'new123', 
        name: 'New Session' 
      }
    }).as('createSession');
    
    // Fill in the session name
    cy.get('#session-name').type('New Session');
    
    // Submit the form
    cy.get('#create-session-form button[type="submit"]').click();
    
    // Check status message during creation
    cy.get('#status-message').should('contain', 'Creating session');
    
    // Wait for the API call to complete
    cy.wait('@createSession');
    
    // Check success message
    cy.get('#status-message').should('contain', 'Session created! Redirecting')
                           .should('have.css', 'color', 'rgb(0, 128, 0)');
    
    // Since we're testing navigation, we can't easily test the actual redirect
    // but we can check that the redirect would happen by stubbing location.href
    cy.window().then((win) => {
      cy.stub(win.location, 'href').as('locationHref');
      
      // Wait for the timeout in the code
      cy.wait(1100).then(() => {
        cy.get('@locationHref').should('be.calledWith', '/observer.html');
      });
    });
  });

  it('should handle session creation failure', () => {
    // Intercept API call to create session with an error
    cy.intercept('POST', '/api/sessions', {
      statusCode: 400,
      body: { 
        error: 'Maximum number of sessions reached' 
      }
    }).as('createSessionError');
    
    // Fill in the session name
    cy.get('#session-name').type('New Session');
    
    // Submit the form
    cy.get('#create-session-form button[type="submit"]').click();
    
    // Wait for the API call to complete
    cy.wait('@createSessionError');
    
    // Check error message
    cy.get('#status-message').should('contain', 'Error: Maximum number of sessions reached')
                           .should('have.css', 'color', 'rgb(255, 0, 0)');
  });

  it('should handle joining a session successfully', () => {
    // Intercept API call to join session
    cy.intercept('POST', '/api/sessions/join', {
      statusCode: 200,
      body: { 
        success: true,
        session: {
          id: 'test123',
          name: 'Test Session'
        }
      }
    }).as('joinSession');
    
    // Go to join session tab
    cy.get('[role="tab"]').last().click();
    
    // Enter a session ID
    cy.get('#session-id').type('test123');
    
    // Click join button
    cy.get('#join-btn').click();
    
    // Check status message during joining
    cy.get('#status-message').should('contain', 'Joining session');
    
    // Wait for the API call to complete
    cy.wait('@joinSession');
    
    // Check success message
    cy.get('#status-message').should('contain', 'Joined session! Redirecting')
                           .should('have.css', 'color', 'rgb(0, 128, 0)');
    
    // Test the redirect intention
    cy.window().then((win) => {
      cy.stub(win.location, 'href').as('locationHref');
      
      // Wait for the timeout in the code
      cy.wait(1100).then(() => {
        cy.get('@locationHref').should('be.calledWith', '/viewer.html');
      });
    });
  });

  it('should handle joining session failure', () => {
    // Intercept API call to join session with an error
    cy.intercept('POST', '/api/sessions/join', {
      statusCode: 404,
      body: { 
        error: 'Session not found' 
      }
    }).as('joinSessionError');
    
    // Go to join session tab
    cy.get('[role="tab"]').last().click();
    
    // Enter a session ID
    cy.get('#session-id').type('nonexistent');
    
    // Click join button
    cy.get('#join-btn').click();
    
    // Wait for the API call to complete
    cy.wait('@joinSessionError');
    
    // Check error message
    cy.get('#status-message').should('contain', 'Error: Session not found')
                           .should('have.css', 'color', 'rgb(255, 0, 0)');
  });

  it('should check for current session on load', () => {
    // Intercept API call to check current session
    cy.intercept('GET', '/api/sessions/current', {
      statusCode: 200,
      body: {
        inSession: true,
        isOwner: true,
        session: {
          id: 'current123',
          name: 'Current Session'
        }
      }
    }).as('getCurrentSession');
    
    // Reload the page to trigger the check
    cy.reload();
    
    // Wait for the API call to complete
    cy.wait('@getCurrentSession');
    
    // Check the status message
    cy.get('#status-message').should('contain', 'You are already in a session');
    
    // Test the redirect intention for an owner (to observer.html)
    cy.window().then((win) => {
      cy.stub(win.location, 'href').as('locationHref');
      
      // Wait for the timeout in the code
      cy.wait(1600).then(() => {
        cy.get('@locationHref').should('be.calledWith', '/observer.html');
      });
    });
  });

  it('should handle session refresh button', () => {
    // First intercept - initial load
    cy.intercept('GET', '/api/sessions', {
      statusCode: 200,
      body: [
        { id: 'test123', name: 'Test Session', fileCount: 5 }
      ]
    }).as('getSessionsInitial');
    
    // Go to join session tab
    cy.get('[role="tab"]').last().click();
    
    // Wait for the initial API call
    cy.wait('@getSessionsInitial');
    
    // Second intercept - after refresh
    cy.intercept('GET', '/api/sessions', {
      statusCode: 200,
      body: [
        { id: 'test123', name: 'Test Session', fileCount: 5 },
        { id: 'new456', name: 'New Session', fileCount: 0 }
      ]
    }).as('getSessionsRefresh');
    
    // Click refresh button
    cy.get('#refresh-btn').click();
    
    // Wait for the refresh API call
    cy.wait('@getSessionsRefresh');
    
    // Check that the list now has two sessions
    cy.get('#session-list .session-item').should('have.length', 2);
    cy.get('#active-sessions').should('contain', '2');
  });

  it('should handle failed API requests gracefully', () => {
    // Intercept API call with a network error
    cy.intercept('GET', '/api/sessions', {
      statusCode: 500,
      body: { error: 'Server error' }
    }).as('getSessionsError');
    
    // Go to join session tab
    cy.get('[role="tab"]').last().click();
    
    // The default "Loading sessions..." message should remain
    cy.get('#session-list').should('contain', 'Loading sessions');
    
    // Should log the error (this is hard to test directly)
    // But we can spy on console.error
    cy.window().then((win) => {
      cy.spy(win.console, 'error').as('consoleError');
    });
    
    // Wait for the API call to fail
    cy.wait('@getSessionsError');
    
    // Check that console.error was called
    cy.get('@consoleError').should('be.called');
  });
});