import Database from 'better-sqlite3';
import path from 'node:path';
import { app } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';

class UserDatabase {
  constructor() {
    this.db = null;
    this.init();
  }

  init() {
    try {
      // Create database in user data directory
      const userDataPath = app.getPath('userData');
      const dbPath = path.join(userDataPath, 'researcher.db');
      
      // Ensure directory exists
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }

      console.log(`[Database] Initializing database at: ${dbPath}`);
      
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL'); // Better performance
      this.db.pragma('foreign_keys = ON'); // Enable foreign key constraints
      
      this.createTables();
      console.log('[Database] Database initialized successfully');
    } catch (error) {
      console.error('[Database] Failed to initialize database:', error);
      throw error;
    }
  }

  createTables() {
    // Users table
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        group_id TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `;

    // User sessions table (for tracking active sessions)
    const createSessionsTable = `
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_token TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;

    // Documents table (for research document management)
    const createDocumentsTable = `
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author_id INTEGER NOT NULL,
        author_username TEXT NOT NULL,
        author_full_name TEXT NOT NULL,
        author_group_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        cover_image_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        file_size INTEGER,
        description TEXT,
        goals TEXT,
        hypotheses TEXT,
        plan TEXT,
        FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;

    this.db.exec(createUsersTable);
    this.db.exec(createSessionsTable);
    this.db.exec(createDocumentsTable);
    
    console.log('[Database] Tables created successfully');
    
    // Test database connectivity
    this.testDatabase();
  }

  // Test database connectivity and table structure
  testDatabase() {
    try {
      // Test if tables exist
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      console.log('[Database] Available tables:', tables.map(t => t.name));
      
      // Test documents table structure
      const documentsColumns = this.db.prepare("PRAGMA table_info(documents)").all();
      console.log('[Database] Documents table columns:', documentsColumns.map(c => c.name));
      
      // Count existing documents
      const documentCount = this.db.prepare("SELECT COUNT(*) as count FROM documents").get();
      console.log('[Database] Existing documents count:', documentCount.count);
      
      console.log('[Database] Database test completed successfully');
    } catch (error) {
      console.error('[Database] Database test failed:', error);
    }
  }

  // Hash password with salt (using faster SHA-256 for performance)
  hashPassword(password, salt = null) {
    if (!salt) {
      salt = crypto.randomBytes(16).toString('hex'); // Smaller salt for better performance
    }
    const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
    return { hash, salt };
  }

  // Register new user
  registerUser(username, fullName, groupId, password) {
    try {
      // Check if username already exists
      const existingUser = this.db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (existingUser) {
        return { success: false, error: 'Username already exists' };
      }

      // Hash password
      const { hash, salt } = this.hashPassword(password);

      // Insert new user
      const insertUser = this.db.prepare(`
        INSERT INTO users (username, full_name, group_id, password_hash, salt)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = insertUser.run(username, fullName, groupId, hash, salt);
      
      console.log(`[Database] User registered successfully: ${username}`);
      return { 
        success: true, 
        userId: result.lastInsertRowid,
        message: 'User registered successfully'
      };
    } catch (error) {
      console.error('[Database] Registration error:', error);
      return { success: false, error: 'Registration failed' };
    }
  }

  // Authenticate user
  authenticateUser(username, password) {
    try {
      // Get user from database
      const user = this.db.prepare(`
        SELECT id, username, full_name, group_id, password_hash, salt 
        FROM users 
        WHERE username = ?
      `).get(username);

      if (!user) {
        return { success: false, error: 'Invalid username or password' };
      }

      // Verify password
      const { hash } = this.hashPassword(password, user.salt);
      if (hash !== user.password_hash) {
        return { success: false, error: 'Invalid username or password' };
      }

      // Update last login
      this.db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
        .run(user.id);

      // Create session token
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Clean up old sessions for this user
      this.db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(user.id);

      // Insert new session
      this.db.prepare(`
        INSERT INTO user_sessions (user_id, session_token, expires_at)
        VALUES (?, ?, ?)
      `).run(user.id, sessionToken, expiresAt.toISOString());

      console.log(`[Database] User authenticated successfully: ${username}`);
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          groupId: user.group_id
        },
        sessionToken
      };
    } catch (error) {
      console.error('[Database] Authentication error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  // Validate session token
  validateSession(sessionToken) {
    try {
      const session = this.db.prepare(`
        SELECT s.user_id, s.expires_at, u.username, u.full_name, u.group_id
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_token = ? AND s.expires_at > CURRENT_TIMESTAMP
      `).get(sessionToken);

      if (!session) {
        return { success: false, error: 'Invalid or expired session' };
      }

      return {
        success: true,
        user: {
          id: session.user_id,
          username: session.username,
          fullName: session.full_name,
          groupId: session.group_id
        }
      };
    } catch (error) {
      console.error('[Database] Session validation error:', error);
      return { success: false, error: 'Session validation failed' };
    }
  }

  // Logout user (invalidate session)
  logoutUser(sessionToken) {
    try {
      const result = this.db.prepare('DELETE FROM user_sessions WHERE session_token = ?')
        .run(sessionToken);
      
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      console.error('[Database] Logout error:', error);
      return { success: false, error: 'Logout failed' };
    }
  }

  // Get user by ID
  getUserById(userId) {
    try {
      const user = this.db.prepare(`
        SELECT id, username, full_name, group_id, created_at, last_login
        FROM users 
        WHERE id = ?
      `).get(userId);

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          groupId: user.group_id,
          createdAt: user.created_at,
          lastLogin: user.last_login
        }
      };
    } catch (error) {
      console.error('[Database] Get user error:', error);
      return { success: false, error: 'Failed to get user' };
    }
  }

  // Clean up expired sessions
  cleanupExpiredSessions() {
    try {
      const result = this.db.prepare('DELETE FROM user_sessions WHERE expires_at <= CURRENT_TIMESTAMP')
        .run();
      
      if (result.changes > 0) {
        console.log(`[Database] Cleaned up ${result.changes} expired sessions`);
      }
    } catch (error) {
      console.error('[Database] Session cleanup error:', error);
    }
  }

  // Save document metadata to database
  saveDocument(documentData, authorData, filePath, coverImagePath = null) {
    try {
      console.log('[Database] saveDocument called with:');
      console.log('[Database] - documentData:', documentData);
      console.log('[Database] - authorData:', authorData);
      console.log('[Database] - filePath:', filePath);
      console.log('[Database] - coverImagePath:', coverImagePath);
      
      const existingDoc = this.db.prepare('SELECT id FROM documents WHERE file_path = ?').get(filePath);
      console.log('[Database] Existing document check result:', existingDoc);
      
      if (existingDoc) {
        // Update existing document
        const updateDoc = this.db.prepare(`
          UPDATE documents 
          SET title = ?, modified_at = CURRENT_TIMESTAMP, file_size = ?, 
              description = ?, goals = ?, hypotheses = ?, plan = ?, cover_image_path = ?
          WHERE id = ?
        `);
        
        let stats = null;
        try {
          stats = fs.statSync(filePath);
        } catch (error) {
          console.log('[Database] File does not exist yet:', filePath);
        }
        const fileSize = stats ? stats.size : null;
        
        updateDoc.run(
          documentData.title || 'Без названия',
          fileSize,
          documentData.description || '',
          documentData.goals || '',
          documentData.hypotheses || '',
          documentData.plan || '',
          coverImagePath,
          existingDoc.id
        );
        
        console.log(`[Database] Document updated: ${documentData.title}`);
        return { success: true, documentId: existingDoc.id, isNew: false };
      } else {
        // Insert new document
        const insertDoc = this.db.prepare(`
          INSERT INTO documents (
            title, author_id, author_username, author_full_name, author_group_id,
            file_path, cover_image_path, file_size, description, goals, hypotheses, plan
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        let stats = null;
        try {
          stats = fs.statSync(filePath);
        } catch (error) {
          console.log('[Database] File does not exist yet:', filePath);
        }
        const fileSize = stats ? stats.size : null;
        
        console.log('[Database] Inserting new document with values:');
        console.log('[Database] - title:', documentData.title || 'Без названия');
        console.log('[Database] - author_id:', authorData.id);
        console.log('[Database] - author_username:', authorData.username);
        console.log('[Database] - author_full_name:', authorData.fullName);
        console.log('[Database] - author_group_id:', authorData.groupId);
        console.log('[Database] - file_path:', filePath);
        console.log('[Database] - cover_image_path:', coverImagePath);
        console.log('[Database] - file_size:', fileSize);
        
        const result = insertDoc.run(
          documentData.title || 'Без названия',
          authorData.id,
          authorData.username,
          authorData.fullName,
          authorData.groupId,
          filePath,
          coverImagePath,
          fileSize,
          documentData.description || '',
          documentData.goals || '',
          documentData.hypotheses || '',
          documentData.plan || ''
        );
        
        console.log('[Database] Insert result:', result);
        console.log(`[Database] New document saved: ${documentData.title} with ID: ${result.lastInsertRowid}`);
        
        // Verify the document was actually inserted
        const verifyDoc = this.db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);
        console.log('[Database] Verification - inserted document:', verifyDoc);
        
        return { success: true, documentId: result.lastInsertRowid, isNew: true };
      }
    } catch (error) {
      console.error('[Database] Save document error:', error);
      return { success: false, error: 'Failed to save document metadata' };
    }
  }

  // Get all documents for a user
  getUserDocuments(userId) {
    try {
      console.log('[Database] getUserDocuments called with userId:', userId);
      
      const documents = this.db.prepare(`
        SELECT * FROM documents 
        WHERE author_id = ? 
        ORDER BY modified_at DESC
      `).all(userId);
      
      console.log('[Database] getUserDocuments query result:', documents);
      console.log('[Database] Found', documents.length, 'documents for user', userId);
      
      return { success: true, documents };
    } catch (error) {
      console.error('[Database] Get user documents error:', error);
      return { success: false, error: 'Failed to get user documents' };
    }
  }

  // Get all documents (for admin view)
  getAllDocuments() {
    try {
      console.log('[Database] getAllDocuments called');
      
      const documents = this.db.prepare(`
        SELECT * FROM documents 
        ORDER BY modified_at DESC
      `).all();
      
      console.log('[Database] getAllDocuments query result:', documents);
      console.log('[Database] Found', documents.length, 'total documents');
      
      return { success: true, documents };
    } catch (error) {
      console.error('[Database] Get all documents error:', error);
      return { success: false, error: 'Failed to get documents' };
    }
  }

  // Get document by ID
  getDocumentById(documentId) {
    try {
      const document = this.db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
      
      if (!document) {
        return { success: false, error: 'Document not found' };
      }
      
      return { success: true, document };
    } catch (error) {
      console.error('[Database] Get document error:', error);
      return { success: false, error: 'Failed to get document' };
    }
  }

  // Get document by file path
  getDocumentByPath(filePath) {
    try {
      console.log('[Database] getDocumentByPath called with filePath:', filePath);
      
      const document = this.db.prepare('SELECT * FROM documents WHERE file_path = ?').get(filePath);
      
      if (!document) {
        console.log('[Database] No document found for path:', filePath);
        return { success: false, error: 'Document not found' };
      }
      
      console.log('[Database] Found document:', document.title);
      return { success: true, document };
    } catch (error) {
      console.error('[Database] Get document by path error:', error);
      return { success: false, error: 'Failed to get document by path' };
    }
  }

  // Delete document from database
  deleteDocument(documentId, userId) {
    try {
      const result = this.db.prepare('DELETE FROM documents WHERE id = ? AND author_id = ?')
        .run(documentId, userId);
      
      if (result.changes === 0) {
        return { success: false, error: 'Document not found or access denied' };
      }
      
      console.log(`[Database] Document deleted: ${documentId}`);
      return { success: true, message: 'Document deleted successfully' };
    } catch (error) {
      console.error('[Database] Delete document error:', error);
      return { success: false, error: 'Failed to delete document' };
    }
  }

  // Search documents by title or content
  searchDocuments(query, userId = null) {
    try {
      let sql = `
        SELECT * FROM documents 
        WHERE (title LIKE ? OR description LIKE ? OR goals LIKE ? OR hypotheses LIKE ? OR plan LIKE ?)
      `;
      let params = [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`];
      
      if (userId) {
        sql += ' AND author_id = ?';
        params.push(userId);
      }
      
      sql += ' ORDER BY modified_at DESC';
      
      const documents = this.db.prepare(sql).all(...params);
      
      return { success: true, documents };
    } catch (error) {
      console.error('[Database] Search documents error:', error);
      return { success: false, error: 'Failed to search documents' };
    }
  }

  // Get all users with document counts
  getAllUsers() {
    try {
      const users = this.db.prepare(`
        SELECT 
          u.id, u.username, u.full_name, u.group_id, u.created_at, u.last_login,
          COUNT(d.id) as document_count
        FROM users u
        LEFT JOIN documents d ON u.id = d.author_id
        GROUP BY u.id, u.username, u.full_name, u.group_id, u.created_at, u.last_login
        ORDER BY u.full_name
      `).all();
      
      const formattedUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        groupId: user.group_id,
        createdAt: user.created_at,
        lastLogin: user.last_login,
        documentCount: user.document_count
      }));
      
      return { success: true, users: formattedUsers };
    } catch (error) {
      console.error('[Database] Get all users error:', error);
      return { success: false, error: 'Failed to get users' };
    }
  }

  // Update user profile
  updateUserProfile(userId, fullName, groupId, currentPassword = null, newPassword = null) {
    try {
      // If changing password, verify current password first
      if (newPassword && currentPassword) {
        const user = this.db.prepare('SELECT password_hash, salt FROM users WHERE id = ?').get(userId);
        if (!user) {
          return { success: false, error: 'User not found' };
        }
        
        const { hash } = this.hashPassword(currentPassword, user.salt);
        if (hash !== user.password_hash) {
          return { success: false, error: 'Current password is incorrect' };
        }
      }
      
      // Update profile information
      if (newPassword) {
        const { hash, salt } = this.hashPassword(newPassword);
        this.db.prepare(`
          UPDATE users 
          SET full_name = ?, group_id = ?, password_hash = ?, salt = ?
          WHERE id = ?
        `).run(fullName, groupId, hash, salt, userId);
      } else {
        this.db.prepare(`
          UPDATE users 
          SET full_name = ?, group_id = ?
          WHERE id = ?
        `).run(fullName, groupId, userId);
      }
      
      console.log(`[Database] User profile updated: ${userId}`);
      return { success: true, message: 'Profile updated successfully' };
    } catch (error) {
      console.error('[Database] Update user profile error:', error);
      return { success: false, error: 'Failed to update profile' };
    }
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close();
      console.log('[Database] Database connection closed');
    }
  }
}

// Create singleton instance
const userDatabase = new UserDatabase();

// Clean up expired sessions every hour
setInterval(() => {
  userDatabase.cleanupExpiredSessions();
}, 60 * 60 * 1000);

export { userDatabase };
