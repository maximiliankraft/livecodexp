import { nanoid } from 'nanoid';

export class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.MAX_SESSIONS = 5;
    this.MAX_FILES_PER_SESSION = 500;
    this.MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    this.MAX_SESSION_SIZE = 50 * 1024 * 1024; // 50 MB
  }

  createSession(name) {
    if (this.sessions.size >= this.MAX_SESSIONS) {
      throw new Error('Maximum number of sessions reached');
    }

    const sessionId = nanoid(10);
    const session = {
      id: sessionId,
      name,
      files: new Map(),
      totalSize: 0,
      createdAt: new Date(),
      clients: [],
      owner: null
    };

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  getAllSessions() {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      name: session.name,
      fileCount: session.files.size,
      totalSize: session.totalSize,
      createdAt: session.createdAt
    }));
  }

  joinSession(sessionId, clientId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.clients.push(clientId);
    return session;
  }

  leaveSession(sessionId, clientId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.clients = session.clients.filter(id => id !== clientId);
    
    // If owner leaves, session gets deleted
    if (session.owner === clientId) {
      session.owner = null;
      this.sessions.delete(sessionId);
    }
    
    // If no clients left, remove the session
    if (session.clients.length === 0) {
      this.sessions.delete(sessionId);
    }
  }

  addFileToSession(sessionId, fileInfo) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.files.size >= this.MAX_FILES_PER_SESSION) {
      throw new Error(`Maximum files per session (${this.MAX_FILES_PER_SESSION}) reached`);
    }

    if (fileInfo.size > this.MAX_FILE_SIZE) {
      throw new Error(`File exceeds maximum size of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    if (session.totalSize + fileInfo.size > this.MAX_SESSION_SIZE) {
      throw new Error(`Session would exceed maximum size of ${this.MAX_SESSION_SIZE / (1024 * 1024)}MB`);
    }

    session.files.set(fileInfo.path, fileInfo);
    session.totalSize += fileInfo.size;

    return true;
  }

  updateFileInSession(sessionId, fileInfo) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const existingFile = session.files.get(fileInfo.path);
    if (!existingFile) {
      return this.addFileToSession(sessionId, fileInfo);
    }

    // Check if the update would exceed session size limit
    const sizeDifference = fileInfo.size - existingFile.size;
    if (session.totalSize + sizeDifference > this.MAX_SESSION_SIZE) {
      throw new Error(`Session would exceed maximum size of ${this.MAX_SESSION_SIZE / (1024 * 1024)}MB`);
    }

    // Update the file
    session.files.set(fileInfo.path, fileInfo);
    session.totalSize += sizeDifference;

    return true;
  }

  removeFileFromSession(sessionId, filePath) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const file = session.files.get(filePath);
    if (file) {
      session.totalSize -= file.size;
      session.files.delete(filePath);
    }
  }

  claimSession(sessionId, clientId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.owner && session.owner !== clientId) {
      throw new Error('Session already has an owner');
    }

    session.owner = clientId;
    return true;
  }

  getSessionStats(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    return {
      id: session.id,
      name: session.name,
      fileCount: session.files.size,
      totalSize: session.totalSize,
      maxFiles: this.MAX_FILES_PER_SESSION,
      maxSize: this.MAX_SESSION_SIZE,
      clientCount: session.clients.length,
      hasOwner: !!session.owner
    };
  }
}

// Singleton instance
export default new SessionManager();