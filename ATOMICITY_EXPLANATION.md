# Atomicity Handling in Lead Operation System

## Overview

The Lead Operation System implements comprehensive atomicity handling to ensure data consistency and reliability. All critical operations are wrapped in database transactions to guarantee that either all changes succeed or none are applied.

## Database Transaction Implementation

### Transaction Wrapper

The system uses a custom transaction wrapper in the database module:

```javascript
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
```

This ensures that:
- All operations within a transaction are atomic
- If any operation fails, all changes are rolled back
- Database connections are properly managed
- No partial updates can occur

## Critical Operations with Atomicity

### 1. Order Creation with Lead Assignment

**Operation**: Create order and assign leads automatically

**Atomicity Implementation**:
```javascript
const result = await db.transaction(async (client) => {
  // 1. Create the order
  const orderResult = await client.query(
    'INSERT INTO orders (customer_name, customer_email) VALUES ($1, $2) RETURNING *',
    [customer_name, customer_email]
  );
  const order = orderResult.rows[0];

  // 2. Get state caps
  const capsResult = await client.query('SELECT state, max_leads FROM state_caps');
  const stateCaps = Object.fromEntries(capsResult.rows.map(row => [row.state, row.max_leads]));

  // 3. Assign leads for each state
  for (const state of states) {
    // Check current assigned count
    const currentCountResult = await client.query(
      'SELECT COUNT(*) as count FROM leads WHERE state = $1 AND status = $2',
      [state, 'assigned']
    );
    const currentCount = parseInt(currentCountResult.rows[0].count);
    const maxLeads = stateCaps[state] || 10;
    const availableSlots = Math.max(0, maxLeads - currentCount);
    const leadsToAssign = Math.min(availableSlots, 5);

    if (leadsToAssign > 0) {
      // Get oldest unassigned leads
      const leadsResult = await client.query(
        `SELECT * FROM leads 
         WHERE state = $1 AND status = 'unassigned' 
         ORDER BY created_at ASC 
         LIMIT $2`,
        [state, leadsToAssign]
      );

      // Assign the leads
      for (const lead of leadsResult.rows) {
        await client.query(
          'UPDATE leads SET status = $1, order_id = $2, updated_at = NOW() WHERE id = $3',
          ['assigned', order.id, lead.id]
        );
      }
    }
  }

  return { order, assignedLeads };
});
```

**Atomicity Guarantees**:
- Order creation and lead assignment happen atomically
- If lead assignment fails, order creation is rolled back
- State cap enforcement is consistent
- No partial lead assignments

### 2. Order Fulfillment

**Operation**: Fulfill an order and update all assigned leads

**Atomicity Implementation**:
```javascript
const result = await db.transaction(async (client) => {
  // 1. Verify order exists and is not already fulfilled
  const orderResult = await client.query(
    'SELECT * FROM orders WHERE id = $1',
    [id]
  );

  if (orderResult.rows.length === 0) {
    throw new Error('Order not found');
  }

  if (orderResult.rows[0].status === 'fulfilled') {
    throw new Error('Order already fulfilled');
  }

  // 2. Update order status
  const updateResult = await client.query(
    'UPDATE orders SET status = $1, fulfilled_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *',
    ['fulfilled', id]
  );

  // 3. Update all assigned leads to fulfilled
  await client.query(
    'UPDATE leads SET status = $1, updated_at = NOW() WHERE order_id = $2',
    ['fulfilled', id]
  );

  return updateResult.rows[0];
});
```

**Atomicity Guarantees**:
- Order status and lead status updates happen atomically
- If any lead update fails, order status is rolled back
- No partial fulfillment states
- Consistent status across all related records

### 3. Order Deletion with Lead Return

**Operation**: Delete order and return all assigned leads to stock

**Atomicity Implementation**:
```javascript
const result = await db.transaction(async (client) => {
  // 1. Verify order exists
  const orderResult = await client.query(
    'SELECT * FROM orders WHERE id = $1',
    [id]
  );

  if (orderResult.rows.length === 0) {
    throw new Error('Order not found');
  }

  // 2. Return all assigned leads to stock
  await client.query(
    'UPDATE leads SET status = $1, order_id = NULL, updated_at = NOW() WHERE order_id = $2',
    ['unassigned', id]
  );

  // 3. Delete the order
  await client.query('DELETE FROM orders WHERE id = $1', [id]);

  return { message: 'Order deleted and leads returned to stock' };
});
```

**Atomicity Guarantees**:
- Lead status updates and order deletion happen atomically
- If order deletion fails, lead status updates are rolled back
- No orphaned leads or orders
- Consistent data state

### 4. Lead Status Updates

**Operation**: Update lead status with validation

**Atomicity Implementation**:
```javascript
const result = await db.transaction(async (client) => {
  // 1. Verify lead exists
  const leadResult = await client.query(
    'SELECT * FROM leads WHERE id = $1',
    [id]
  );

  if (leadResult.rows.length === 0) {
    throw new Error('Lead not found');
  }

  // 2. Validate status transition
  const currentStatus = leadResult.rows[0].status;
  if (!isValidStatusTransition(currentStatus, status)) {
    throw new Error('Invalid status transition');
  }

  // 3. Update lead status
  const updateResult = await client.query(
    'UPDATE leads SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, id]
  );

  return updateResult.rows[0];
});
```

**Atomicity Guarantees**:
- Status validation and update happen atomically
- Invalid transitions are rejected before any changes
- Consistent status state

## Concurrency Safety

### Row-Level Locking

The system relies on PostgreSQL's row-level locking to handle concurrent access:

```sql
-- Example: Atomic lead assignment with locking
BEGIN;
SELECT * FROM leads 
WHERE state = $1 AND status = 'unassigned' 
ORDER BY created_at ASC 
LIMIT $2
FOR UPDATE SKIP LOCKED;

UPDATE leads SET status = 'assigned', order_id = $3 
WHERE id = ANY($4);
COMMIT;
```

**Benefits**:
- Prevents race conditions during lead assignment
- Ensures consistent state cap enforcement
- Handles concurrent order creation safely

### Transaction Isolation

All transactions use PostgreSQL's default isolation level (READ COMMITTED) with additional locking where needed:

```javascript
// Example: Safe concurrent order creation
const result = await db.transaction(async (client) => {
  // Lock state caps table to prevent race conditions
  await client.query('SELECT * FROM state_caps FOR UPDATE');
  
  // Check current assigned counts
  const currentCountResult = await client.query(
    'SELECT COUNT(*) as count FROM leads WHERE state = $1 AND status = $2',
    [state, 'assigned']
  );
  
  // Proceed with assignment...
});
```

## Idempotency Implementation

### 1. Duplicate Prevention

**Unique Constraints**:
```sql
-- Prevent duplicate orders
ALTER TABLE orders ADD CONSTRAINT unique_customer_email UNIQUE (customer_email);

-- Prevent duplicate leads
ALTER TABLE leads ADD CONSTRAINT unique_lead_email UNIQUE (email);
```

### 2. Status-Based Idempotency

**Order Fulfillment**:
```javascript
// Check current status before updating
if (orderResult.rows[0].status === 'fulfilled') {
  throw new Error('Order already fulfilled');
}
```

**Lead Assignment**:
```javascript
// Check if lead is already assigned
if (lead.status === 'assigned') {
  continue; // Skip already assigned leads
}
```

### 3. Safe Retry Logic

**Automation Commands**:
```javascript
// Example: Idempotent order creation
const existingOrder = await client.query(
  'SELECT * FROM orders WHERE customer_email = $1',
  [customer_email]
);

if (existingOrder.rows.length > 0) {
  return existingOrder.rows[0]; // Return existing order
}
```

## Error Recovery

### 1. Transaction Rollback

All errors trigger automatic rollback:
```javascript
try {
  await client.query('BEGIN');
  // Operations...
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error; // Re-throw for proper error handling
}
```

### 2. Connection Management

Proper connection handling ensures no resource leaks:
```javascript
finally {
  client.release(); // Always release connection
}
```

### 3. Error Propagation

Errors are properly propagated with context:
```javascript
catch (error) {
  console.error('Database operation failed:', error);
  throw new Error(`Operation failed: ${error.message}`);
}
```

## Performance Considerations

### 1. Transaction Scope

Transactions are kept as short as possible:
- Only critical operations are wrapped in transactions
- Non-critical operations (logging, statistics) are outside transactions
- Batch operations are preferred over individual transactions

### 2. Lock Duration

Locks are held for minimal time:
- State cap checks are done early in transactions
- Lead assignments happen quickly
- Long-running operations are avoided

### 3. Deadlock Prevention

Consistent lock ordering prevents deadlocks:
- Always lock state_caps before leads
- Always lock orders before leads
- Consistent transaction patterns

## Monitoring and Debugging

### 1. Transaction Logging

All transactions are logged for debugging:
```javascript
const start = Date.now();
try {
  const result = await db.transaction(callback);
  const duration = Date.now() - start;
  console.log('Transaction completed', { duration, result });
  return result;
} catch (error) {
  const duration = Date.now() - start;
  console.error('Transaction failed', { duration, error });
  throw error;
}
```

### 2. Performance Metrics

Transaction performance is monitored:
- Execution time tracking
- Lock wait time monitoring
- Deadlock detection
- Connection pool usage

### 3. Error Tracking

All transaction errors are tracked:
- Error types and frequencies
- Rollback reasons
- Performance impact
- Recovery success rates

## Best Practices

### 1. Transaction Design

- Keep transactions short and focused
- Avoid long-running operations in transactions
- Use appropriate isolation levels
- Handle errors gracefully

### 2. Lock Management

- Acquire locks in consistent order
- Release locks as soon as possible
- Use appropriate lock types (shared vs exclusive)
- Monitor lock contention

### 3. Error Handling

- Always handle transaction errors
- Provide meaningful error messages
- Log errors for debugging
- Implement retry logic where appropriate

### 4. Testing

- Test concurrent operations
- Verify rollback behavior
- Test error scenarios
- Monitor performance under load

## Conclusion

The Lead Operation System implements comprehensive atomicity handling through:

1. **Database Transactions**: All critical operations are atomic
2. **Concurrency Safety**: Row-level locking prevents race conditions
3. **Idempotency**: Operations are safe to retry
4. **Error Recovery**: Proper rollback and error handling
5. **Performance**: Optimized transaction scope and lock management

This ensures data consistency, reliability, and performance while maintaining the system's ability to handle concurrent operations safely.
