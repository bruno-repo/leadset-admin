const express = require('express');
const db = require('../database/simple');

const router = express.Router();

// Automation mode endpoint for plain-text operations
router.post('/execute', async (req, res) => {
  const { command, params } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  try {
    let result;
    
    switch (command.toLowerCase()) {
      case 'create_order':
        result = await createOrderAutomation(params);
        break;
      case 'fulfill_order':
        result = await fulfillOrderAutomation(params);
        break;
      case 'delete_order':
        result = await deleteOrderAutomation(params);
        break;
      case 'get_orders':
        result = await getOrdersAutomation(params);
        break;
      case 'get_leads':
        result = await getLeadsAutomation(params);
        break;
      case 'one_time_rule':
        result = await executeOneTimeRule(params);
        break;
      default:
        return res.status(400).json({ error: 'Unknown command' });
    }

    res.json({
      success: true,
      command,
      result,
      timestamp: db.formatTimestamp(db.getCurrentTime())
    });
  } catch (error) {
    console.error('Automation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: db.formatTimestamp(db.getCurrentTime())
    });
  }
});

// One Time automation rule implementation
async function executeOneTimeRule(params) {
  const { orderId, action } = params;

  if (!orderId || !action) {
    throw new Error('Order ID and action are required for One Time rule');
  }

  try {
    const result = await db.transaction(async (client) => {
      // Get order details
      const orderResult = await client.query(
        'SELECT * FROM orders WHERE id = ?',
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        throw new Error('Order not found');
      }

      const order = orderResult.rows[0];

      switch (action.toLowerCase()) {
        case 'fulfill':
          if (order.status === 'fulfilled') {
            return { message: 'Order already fulfilled', order };
          }
          
          // Fulfill the order
          await client.query(
            'UPDATE orders SET status = ?, fulfilled_at = datetime("now"), updated_at = datetime("now") WHERE id = ?',
            ['fulfilled', orderId]
          );
          
          // Update all assigned leads to fulfilled
          await client.query(
            'UPDATE leads SET status = ?, updated_at = datetime("now") WHERE order_id = ?',
            ['fulfilled', orderId]
          );
          
          return { message: 'Order fulfilled successfully', orderId };

        case 'cancel':
          if (order.status === 'cancelled') {
            return { message: 'Order already cancelled', order };
          }
          
          // Cancel the order and return leads to stock
          await client.query(
            'UPDATE orders SET status = ?, updated_at = datetime("now") WHERE id = ?',
            ['cancelled', orderId]
          );
          
          await client.query(
            'UPDATE leads SET status = ?, order_id = NULL, updated_at = datetime("now") WHERE order_id = ?',
            ['unassigned', orderId]
          );
          
          return { message: 'Order cancelled and leads returned to stock', orderId };

        default:
          throw new Error('Invalid action. Use "fulfill" or "cancel"');
      }
    });

    return result;
  } catch (error) {
    throw new Error(`One Time rule execution failed: ${error.message}`);
  }
}

// Automation helper functions
async function createOrderAutomation(params) {
  const { customer_name, customer_email, requested_states } = params;

  if (!customer_name || !customer_email) {
    throw new Error('Customer name and email are required');
  }

  const result = await db.transaction(async (client) => {
      // Create the order
      const orderResult = await client.query(
        'INSERT INTO orders (customer_name, customer_email) VALUES (?, ?)',
        [customer_name, customer_email]
      );
      
      // Get the created order
      const createdOrder = await client.query(
        'SELECT * FROM orders WHERE id = ?',
        [orderResult.lastID]
      );
      const order = createdOrder.rows[0];

    // Get state caps
    const capsResult = await client.query('SELECT state, max_leads FROM state_caps');
    const stateCaps = Object.fromEntries(capsResult.rows.map(row => [row.state, row.max_leads]));

    const assignedLeads = [];
    const states = requested_states || ['CA', 'NY', 'TX', 'FL', 'IL'];

    // Assign leads for each requested state
    for (const state of states) {
      const maxLeads = stateCaps[state] || 10;
      
      const currentCountResult = await client.query(
        'SELECT COUNT(*) as count FROM leads WHERE state = ? AND status = ?',
        [state, 'assigned']
      );
      const currentCount = parseInt(currentCountResult.rows[0].count);

      const availableSlots = Math.max(0, maxLeads - currentCount);
      const leadsToAssign = Math.min(availableSlots, 5);

      if (leadsToAssign > 0) {
        const leadsResult = await client.query(
          `SELECT * FROM leads 
           WHERE state = ? AND status = 'unassigned' 
           ORDER BY created_at ASC 
           LIMIT ?`,
          [state, leadsToAssign]
        );

        for (const lead of leadsResult.rows) {
          await client.query(
            'UPDATE leads SET status = ?, order_id = ?, updated_at = datetime("now") WHERE id = ?',
            ['assigned', order.id, lead.id]
          );
          assignedLeads.push({ ...lead, status: 'assigned', order_id: order.id });
        }
      }
    }

    return { order, assignedLeads };
  });

  return result;
}

async function fulfillOrderAutomation(params) {
  const { orderId } = params;

  if (!orderId) {
    throw new Error('Order ID is required');
  }

  const result = await db.transaction(async (client) => {
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = ?',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new Error('Order not found');
    }

    if (orderResult.rows[0].status === 'fulfilled') {
      throw new Error('Order already fulfilled');
    }

    await client.query(
      'UPDATE orders SET status = ?, fulfilled_at = datetime("now"), updated_at = datetime("now") WHERE id = ?',
      ['fulfilled', orderId]
    );

    await client.query(
      'UPDATE leads SET status = ?, updated_at = datetime("now") WHERE order_id = ?',
      ['fulfilled', orderId]
    );

    return { message: 'Order fulfilled successfully', orderId };
  });

  return result;
}

async function deleteOrderAutomation(params) {
  const { orderId } = params;

  if (!orderId) {
    throw new Error('Order ID is required');
  }

  const result = await db.transaction(async (client) => {
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = ?',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new Error('Order not found');
    }

    await client.query(
      'UPDATE leads SET status = ?, order_id = NULL, updated_at = datetime("now") WHERE order_id = ?',
      ['unassigned', orderId]
    );

    await client.query('DELETE FROM orders WHERE id = ?', [orderId]);

    return { message: 'Order deleted and leads returned to stock', orderId };
  });

  return result;
}

async function getOrdersAutomation(params) {
  const { status, limit = 10 } = params;

  let whereClause = '';
  let queryParams = [];

  if (status) {
    whereClause = 'WHERE o.status = ?';
    queryParams.push(status);
  }

  // Add limit parameter at the end
  queryParams.push(parseInt(limit));

  const result = await db.query(
    `SELECT o.*, COUNT(l.id) as lead_count
     FROM orders o
     LEFT JOIN leads l ON o.id = l.order_id
     ${whereClause}
     GROUP BY o.id
     ORDER BY o.created_at DESC
     LIMIT ?`,
    queryParams
  );

  return result.rows.map(order => ({
    ...order,
    created_at: db.formatTimestamp(order.created_at),
    updated_at: db.formatTimestamp(order.updated_at),
    fulfilled_at: order.fulfilled_at ? db.formatTimestamp(order.fulfilled_at) : null,
    lead_count: parseInt(order.lead_count)
  }));
}

async function getLeadsAutomation(params) {
  const { status, state, limit = 10 } = params;

  let whereConditions = [];
  let queryParams = [];

  if (status) {
    whereConditions.push(`status = ?`);
    queryParams.push(status);
  }

  if (state) {
    whereConditions.push(`state = ?`);
    queryParams.push(state);
  }

  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  // Add limit parameter at the end
  queryParams.push(parseInt(limit));

  const result = await db.query(
    `SELECT * FROM leads 
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT ?`,
    queryParams
  );

  return result.rows.map(lead => ({
    ...lead,
    created_at: db.formatTimestamp(lead.created_at),
    updated_at: db.formatTimestamp(lead.updated_at)
  }));
}

// Get automation rules
router.get('/rules', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM automation_rules ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching automation rules:', error);
    res.status(500).json({ error: 'Failed to fetch automation rules' });
  }
});

// Create automation rule
router.post('/rules', async (req, res) => {
  const { name, type, config } = req.body;

  if (!name || !type || !config) {
    return res.status(400).json({ error: 'Name, type, and config are required' });
  }

  try {
    const result = await db.query(
      'INSERT INTO automation_rules (name, type, config) VALUES (?, ?, ?)',
      [name, type, JSON.stringify(config)]
    );

    // Get the created rule
    const createdRule = await db.query(
      'SELECT * FROM automation_rules WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json(createdRule.rows[0]);
  } catch (error) {
    console.error('Error creating automation rule:', error);
    res.status(500).json({ error: 'Failed to create automation rule' });
  }
});

module.exports = router;
