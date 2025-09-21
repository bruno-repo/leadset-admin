const express = require('express');
const db = require('../database/simple');

const router = express.Router();

// Get all leads with pagination and filtering
router.get('/', async (req, res) => {
  const { page = 1, limit = 10, status, state } = req.query;
  const offset = (page - 1) * limit;

  try {
    let whereConditions = [];
    let params = [limit, offset];
    let paramCount = 2;

    if (status) {
      whereConditions.push(`status = $${++paramCount}`);
      params.push(status);
    }

    if (state) {
      whereConditions.push(`state = $${++paramCount}`);
      params.push(state);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const leadsResult = await db.query(
      `SELECT * FROM leads 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM leads ${whereClause}`,
      params.slice(2)
    );

    const leads = leadsResult.rows.map(lead => ({
      ...lead,
      created_at: db.formatTimestamp(lead.created_at),
      updated_at: db.formatTimestamp(lead.updated_at)
    }));

    res.json({
      leads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Get lead statistics
router.get('/stats', async (req, res) => {
  try {
    const statsResult = await db.query(`
      SELECT 
        status,
        state,
        COUNT(*) as count
      FROM leads 
      GROUP BY status, state
      ORDER BY state, status
    `);

    const stateCapsResult = await db.query(`
      SELECT state, max_leads FROM state_caps
    `);

    const stats = {
      byStatus: {},
      byState: {},
      stateCaps: Object.fromEntries(stateCapsResult.rows.map(row => [row.state, row.max_leads]))
    };

    statsResult.rows.forEach(row => {
      if (!stats.byStatus[row.status]) {
        stats.byStatus[row.status] = 0;
      }
      stats.byStatus[row.status] += parseInt(row.count);

      if (!stats.byState[row.state]) {
        stats.byState[row.state] = {};
      }
      stats.byState[row.state][row.status] = parseInt(row.count);
    });

    res.json(stats);
  } catch (error) {
    console.error('Error fetching lead stats:', error);
    res.status(500).json({ error: 'Failed to fetch lead statistics' });
  }
});

// Create a new lead
router.post('/', async (req, res) => {
  const { name, email, phone, state } = req.body;

  if (!name || !email || !state) {
    return res.status(400).json({ error: 'Name, email, and state are required' });
  }

  try {
    const result = await db.query(
      'INSERT INTO leads (name, email, phone, state) VALUES (?, ?, ?, ?)',
      [name, email, phone, state]
    );

    // Get the inserted lead
    const insertedLead = await db.query(
      'SELECT * FROM leads WHERE id = ?',
      [result.lastID]
    );

    const lead = {
      ...insertedLead.rows[0],
      created_at: db.formatTimestamp(insertedLead.rows[0].created_at),
      updated_at: db.formatTimestamp(insertedLead.rows[0].updated_at)
    };

    res.status(201).json(lead);
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Update lead status
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['unassigned', 'assigned', 'fulfilled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const result = await db.query(
      'UPDATE leads SET status = ?, updated_at = datetime("now") WHERE id = ?',
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Get the updated lead
    const updatedLead = await db.query(
      'SELECT * FROM leads WHERE id = ?',
      [id]
    );

    const lead = {
      ...updatedLead.rows[0],
      created_at: db.formatTimestamp(updatedLead.rows[0].created_at),
      updated_at: db.formatTimestamp(updatedLead.rows[0].updated_at)
    };

    res.json(lead);
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// Get state caps
router.get('/caps', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM state_caps ORDER BY state');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching state caps:', error);
    res.status(500).json({ error: 'Failed to fetch state caps' });
  }
});

// Update state caps
router.put('/caps', async (req, res) => {
  const { caps } = req.body;

  if (!caps || typeof caps !== 'object') {
    return res.status(400).json({ error: 'Caps object is required' });
  }

  try {
    await db.transaction(async (client) => {
      for (const [state, maxLeads] of Object.entries(caps)) {
        await client.query(
          'INSERT INTO state_caps (state, max_leads) VALUES (?, ?) ON CONFLICT (state) DO UPDATE SET max_leads = ?, updated_at = datetime("now")',
          [state, maxLeads]
        );
      }
    });

    res.json({ message: 'State caps updated successfully' });
  } catch (error) {
    console.error('Error updating state caps:', error);
    res.status(500).json({ error: 'Failed to update state caps' });
  }
});

module.exports = router;
