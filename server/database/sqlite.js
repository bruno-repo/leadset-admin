const sqlite3 = require('sqlite3').verbose();
const moment = require('moment-timezone');

class Database {
  constructor() {
    this.db = new sqlite3.Database('./database.sqlite');
  }

  async initialize() {
    try {
      // Create tables if they don't exist
      await this.createTables();
      console.log('SQLite database initialized');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  async createTables() {
    const createTablesSQL = `
      -- Leads table
      CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        state TEXT NOT NULL,
        status TEXT DEFAULT 'unassigned' CHECK (status IN ('unassigned', 'assigned', 'fulfilled')),
        order_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Orders table
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        fulfilled_at DATETIME
      );

      -- State caps table for lead limits per state
      CREATE TABLE IF NOT EXISTS state_caps (
        state TEXT PRIMARY KEY,
        max_leads INTEGER NOT NULL DEFAULT 10,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Automation rules table
      CREATE TABLE IF NOT EXISTS automation_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        config TEXT NOT NULL,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Insert default state caps if not exist
      INSERT OR IGNORE INTO state_caps (state, max_leads) VALUES 
        ('CA', 10), ('NY', 10), ('TX', 10), ('FL', 10), ('IL', 10);

      -- Insert sample leads
      INSERT OR IGNORE INTO leads (name, email, phone, state, status) VALUES
        ('John Smith', 'john.smith@email.com', '555-0101', 'CA', 'unassigned'),
        ('Jane Doe', 'jane.doe@email.com', '555-0102', 'CA', 'unassigned'),
        ('Bob Johnson', 'bob.johnson@email.com', '555-0103', 'NY', 'unassigned'),
        ('Alice Brown', 'alice.brown@email.com', '555-0104', 'NY', 'unassigned'),
        ('Charlie Wilson', 'charlie.wilson@email.com', '555-0105', 'TX', 'unassigned'),
        ('Diana Davis', 'diana.davis@email.com', '555-0106', 'TX', 'unassigned'),
        ('Eve Miller', 'eve.miller@email.com', '555-0107', 'FL', 'unassigned'),
        ('Frank Garcia', 'frank.garcia@email.com', '555-0108', 'FL', 'unassigned'),
        ('Grace Lee', 'grace.lee@email.com', '555-0109', 'IL', 'unassigned'),
        ('Henry Taylor', 'henry.taylor@email.com', '555-0110', 'IL', 'unassigned');
    `;

    return new Promise((resolve, reject) => {
      this.db.exec(createTablesSQL, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async query(text, params = []) {
    return new Promise((resolve, reject) => {
      if (text.trim().toUpperCase().startsWith('SELECT')) {
        this.db.all(text, params, (err, rows) => {
          if (err) reject(err);
          else resolve({ rows, rowCount: rows.length });
        });
      } else {
        this.db.run(text, params, function(err) {
          if (err) reject(err);
          else resolve({ rowCount: this.changes, lastID: this.lastID });
        });
      }
    });
  }

  async transaction(callback) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        const mockClient = {
          query: (text, params = []) => {
            return new Promise((resolveQuery, rejectQuery) => {
              if (text.trim().toUpperCase().startsWith('SELECT')) {
                this.db.all(text, params, (err, rows) => {
                  if (err) rejectQuery(err);
                  else resolveQuery({ rows, rowCount: rows.length });
                });
              } else if (text.trim().toUpperCase().startsWith('INSERT')) {
                this.db.run(text, params, function(err) {
                  if (err) rejectQuery(err);
                  else resolveQuery({ 
                    rows: [{ id: this.lastID }], 
                    rowCount: this.changes,
                    lastID: this.lastID 
                  });
                });
              } else {
                this.db.run(text, params, function(err) {
                  if (err) rejectQuery(err);
                  else resolveQuery({ rowCount: this.changes, lastID: this.lastID });
                });
              }
            });
          }
        };

        callback(mockClient)
          .then(result => {
            this.db.run('COMMIT', (err) => {
              if (err) reject(err);
              else resolve(result);
            });
          })
          .catch(error => {
            this.db.run('ROLLBACK', (err) => {
              if (err) reject(err);
              else reject(error);
            });
          });
      });
    });
  }

  // Helper method to get current time in America/New_York timezone
  getCurrentTime() {
    return moment().tz('America/New_York');
  }

  // Helper method to format timestamp for display
  formatTimestamp(timestamp) {
    return moment(timestamp).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss z');
  }

  async close() {
    return new Promise((resolve) => {
      this.db.close(resolve);
    });
  }
}

module.exports = new Database();
