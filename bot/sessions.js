/**
 * In-memory session manager for WhatsApp bot conversations.
 * Tracks each student's position in the booking flow.
 * Sessions expire after 30 minutes of inactivity.
 */

class SessionManager {
  constructor(timeoutMs = 30 * 60 * 1000) {
    this.sessions = new Map();
    this.timeoutMs = timeoutMs;

    // Clean up expired sessions every 5 minutes
    this._cleanupInterval = setInterval(() => this._cleanup(), 5 * 60 * 1000);
  }

  /**
   * Get session for a phone number.
   * Returns null if no session or session expired.
   */
  get(phone) {
    const session = this.sessions.get(phone);
    if (!session) return null;

    if (Date.now() - session.lastActivity > this.timeoutMs) {
      this.sessions.delete(phone);
      return null;
    }

    session.lastActivity = Date.now();
    return session;
  }

  /**
   * Create or update session for a phone number.
   */
  set(phone, data) {
    this.sessions.set(phone, {
      ...data,
      phone,
      lastActivity: Date.now()
    });
  }

  /**
   * Update specific fields in an existing session.
   */
  update(phone, updates) {
    const session = this.get(phone);
    if (session) {
      Object.assign(session, updates);
      session.lastActivity = Date.now();
    }
    return session;
  }

  /**
   * Delete a session.
   */
  delete(phone) {
    this.sessions.delete(phone);
  }

  /**
   * Clean up expired sessions.
   */
  _cleanup() {
    const now = Date.now();
    for (const [phone, session] of this.sessions) {
      if (now - session.lastActivity > this.timeoutMs) {
        this.sessions.delete(phone);
      }
    }
  }

  /**
   * Stop the cleanup interval (for graceful shutdown).
   */
  destroy() {
    clearInterval(this._cleanupInterval);
  }
}

// Export a singleton instance
const sessionManager = new SessionManager();

module.exports = sessionManager;
