const sqlite3 = require('sqlite3').verbose();
const moment = require('moment-timezone');

class Database {
  constructor() {
    this.db = new sqlite3.Database('./database.sqlite');
  }

  async initialize() {
    try {
      // Test connection
      await this.pool.query('SELECT NOW()');
      
      // Create tables if they don't exist
      await this.createTables();
      console.log('Database connection established');
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  async createTables() {
    const createTablesSQL = `
      -- Leads table
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        state VARCHAR(2) NOT NULL,
        status VARCHAR(20) DEFAULT 'unassigned' CHECK (status IN ('unassigned', 'assigned', 'fulfilled')),
        order_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Orders table
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        fulfilled_at TIMESTAMP WITH TIME ZONE
      );

      -- State caps table for lead limits per state
      CREATE TABLE IF NOT EXISTS state_caps (
        state VARCHAR(2) PRIMARY KEY,
        max_leads INTEGER NOT NULL DEFAULT 10,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Automation rules table
      CREATE TABLE IF NOT EXISTS automation_rules (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        config JSONB NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_leads_state_status ON leads(state, status);
      CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

      -- Insert default state caps if not exist
      INSERT INTO state_caps (state, max_leads) 
      SELECT state, 10 
      FROM (VALUES ('CA'), ('NY'), ('TX'), ('FL'), ('IL')) AS states(state)
      WHERE NOT EXISTS (SELECT 1 FROM state_caps);
    `;

    await this.pool.query(createTablesSQL);
  }

  async query(text, params) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: result.rowCount });
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
    await this.pool.end();
  }
}

module.exports = new Database();
