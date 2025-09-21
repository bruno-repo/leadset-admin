const express = require('express');
const db = require('../database/simple');
const moment = require('moment-timezone');

const router = express.Router();

// Create a new order and automatically assign leads
router.post('/', async (req, res) => {
  const { customer_name, customer_email, requested_states } = req.body;

  if (!customer_name || !customer_email) {
    return res.status(400).json({ error: 'Customer name and email are required' });
  }

  try {
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
      const states = requested_states || ['CA', 'NY', 'TX', 'FL', 'IL']; // Default states

      // Assign leads for each requested state
      for (const state of states) {
        const maxLeads = stateCaps[state] || 10;
        
        // Get current assigned count for this state
        const currentCountResult = await client.query(
          'SELECT COUNT(*) as count FROM leads WHERE state = ? AND status = ?',
          [state, 'assigned']
        );
        const currentCount = parseInt(currentCountResult.rows[0].count);

        // Calculate how many leads we can assign (respecting state cap)
        const availableSlots = Math.max(0, maxLeads - currentCount);
        const leadsToAssign = Math.min(availableSlots, 5); // Max 5 leads per state per order

        if (leadsToAssign > 0) {
          // Get oldest unassigned leads for this state
          const leadsResult = await client.query(
            `SELECT * FROM leads 
             WHERE state = ? AND status = 'unassigned' 
             ORDER BY created_at ASC 
             LIMIT ?`,
            [state, leadsToAssign]
          );

          // Assign the leads
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

    res.status(201).json({
      order: {
        ...result.order,
        created_at: db.formatTimestamp(result.order.created_at)
      },
      assignedLeads: result.assignedLeads.map(lead => ({
        ...lead,
        created_at: db.formatTimestamp(lead.created_at),
        updated_at: db.formatTimestamp(lead.updated_at)
      }))
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get all orders with pagination
router.get('/', async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const offset = (page - 1) * limit;

  try {
    let whereClause = '';
    let params = [limit, offset];
    let paramCount = 2;

    if (status) {
      whereClause = `WHERE o.status = ?`;
      params.push(status);
    }

    const ordersResult = await db.query(
      `SELECT o.*, 
              COUNT(l.id) as lead_count,
              STRING_AGG(l.state, ',') as states
       FROM orders o
       LEFT JOIN leads l ON o.id = l.order_id
       ${whereClause}
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
      params.slice(2)
    );

    const orders = ordersResult.rows.map(order => ({
      ...order,
      created_at: db.formatTimestamp(order.created_at),
      updated_at: db.formatTimestamp(order.updated_at),
      fulfilled_at: order.fulfilled_at ? db.formatTimestamp(order.fulfilled_at) : null,
      lead_count: parseInt(order.lead_count),
      states: order.states ? order.states.split(',') : []
    }));

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get order details with assigned leads
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const orderResult = await db.query(
      'SELECT * FROM orders WHERE id = ?',
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const leadsResult = await db.query(
      'SELECT * FROM leads WHERE order_id = ? ORDER BY created_at ASC',
      [id]
    );

    const order = {
      ...orderResult.rows[0],
      created_at: db.formatTimestamp(orderResult.rows[0].created_at),
      updated_at: db.formatTimestamp(orderResult.rows[0].updated_at),
      fulfilled_at: orderResult.rows[0].fulfilled_at ? db.formatTimestamp(orderResult.rows[0].fulfilled_at) : null,
      leads: leadsResult.rows.map(lead => ({
        ...lead,
        created_at: db.formatTimestamp(lead.created_at),
        updated_at: db.formatTimestamp(lead.updated_at)
      }))
    };

    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Fulfill an order manually
router.patch('/:id/fulfill', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.transaction(async (client) => {
      // Check if order exists and is not already fulfilled
      const orderResult = await client.query(
        'SELECT * FROM orders WHERE id = ?',
        [id]
      );

      if (orderResult.rows.length === 0) {
        throw new Error('Order not found');
      }

      if (orderResult.rows[0].status === 'fulfilled') {
        throw new Error('Order already fulfilled');
      }

      // Update order status
      await client.query(
        'UPDATE orders SET status = ?, fulfilled_at = datetime("now"), updated_at = datetime("now") WHERE id = ?',
        ['fulfilled', id]
      );

      // Update all assigned leads to fulfilled
      await client.query(
        'UPDATE leads SET status = ?, updated_at = datetime("now") WHERE order_id = ?',
        ['fulfilled', id]
      );

      // Get the updated order
      const updatedOrder = await client.query(
        'SELECT * FROM orders WHERE id = ?',
        [id]
      );

      return updatedOrder.rows[0];
    });

    res.json({
      ...result,
      created_at: db.formatTimestamp(result.created_at),
      updated_at: db.formatTimestamp(result.updated_at),
      fulfilled_at: db.formatTimestamp(result.fulfilled_at)
    });
  } catch (error) {
    console.error('Error fulfilling order:', error);
    res.status(500).json({ error: error.message || 'Failed to fulfill order' });
  }
});

// Delete an order and return leads to stock
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.transaction(async (client) => {
      // Check if order exists
      const orderResult = await client.query(
        'SELECT * FROM orders WHERE id = ?',
        [id]
      );

      if (orderResult.rows.length === 0) {
        throw new Error('Order not found');
      }

      // Return all assigned leads to stock
      await client.query(
        'UPDATE leads SET status = ?, order_id = NULL, updated_at = datetime("now") WHERE order_id = ?',
        ['unassigned', id]
      );

      // Delete the order
      await client.query('DELETE FROM orders WHERE id = ?', [id]);

      return { message: 'Order deleted and leads returned to stock' };
    });

    res.json(result);
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: error.message || 'Failed to delete order' });
  }
});

// Export fulfilled orders as CSV
router.get('/export/csv', async (req, res) => {
  try {
    const ordersResult = await db.query(
      `SELECT o.*, l.name as lead_name, l.email as lead_email, l.phone as lead_phone, l.state as lead_state
       FROM orders o
       JOIN leads l ON o.id = l.order_id
       WHERE o.status = 'fulfilled'
       ORDER BY o.fulfilled_at DESC, o.id, l.created_at`
    );

    if (ordersResult.rows.length === 0) {
      return res.status(404).json({ error: 'No fulfilled orders found' });
    }

    // Create CSV content
    const headers = [
      'Order ID', 'Customer Name', 'Customer Email', 'Order Created',
      'Order Fulfilled', 'Lead Name', 'Lead Email', 'Lead Phone', 'Lead State'
    ];

    const csvRows = ordersResult.rows.map(row => [
      row.id,
      `"${row.customer_name}"`,
      `"${row.customer_email}"`,
      db.formatTimestamp(row.created_at),
      db.formatTimestamp(row.fulfilled_at),
      `"${row.lead_name}"`,
      `"${row.lead_email}"`,
      `"${row.lead_phone || ''}"`,
      row.lead_state
    ]);

    const csvContent = [headers, ...csvRows]
      .map(row => row.join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="fulfilled_orders.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

module.exports = router;
