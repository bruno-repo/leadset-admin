# Test Plan - Lead Operation System

## Overview
This test plan covers the core functionality of the Lead Operation System, focusing on critical business logic, data integrity, and user workflows.

## Test Environment Setup

### Prerequisites
- Docker and Docker Compose installed
- PostgreSQL client (optional, for direct database testing)
- API testing tool (Postman, curl, or similar)

### Test Data Setup
```bash
# Start the application
docker-compose up -d

# Wait for services to be ready
docker-compose logs -f app
```

## Test Categories

### 1. Order Management Tests

#### 1.1 Order Creation with Automatic Lead Assignment
**Objective**: Verify orders are created and leads are automatically assigned

**Test Steps**:
1. Create a new order via API
2. Verify order is created with correct customer information
3. Verify leads are automatically assigned (oldest first)
4. Verify state caps are respected
5. Verify assigned leads have correct status

**Expected Results**:
- Order created successfully
- Leads assigned in chronological order (oldest first)
- State caps enforced (max leads per state)
- Lead status updated to 'assigned'
- Order status is 'pending'

**API Test**:
```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Test Customer",
    "customer_email": "test@example.com",
    "requested_states": ["CA", "NY"]
  }'
```

#### 1.2 Manual Order Fulfillment
**Objective**: Verify orders can be manually fulfilled

**Test Steps**:
1. Create an order with assigned leads
2. Fulfill the order via API
3. Verify order status changes to 'fulfilled'
4. Verify all assigned leads status changes to 'fulfilled'
5. Verify fulfillment timestamp is recorded

**Expected Results**:
- Order status: 'fulfilled'
- All leads status: 'fulfilled'
- Fulfilled timestamp recorded
- Operation is idempotent (safe to retry)

#### 1.3 Order Deletion with Lead Return
**Objective**: Verify order deletion returns leads to stock

**Test Steps**:
1. Create an order with assigned leads
2. Delete the order via API
3. Verify order is deleted
4. Verify all assigned leads return to 'unassigned' status
5. Verify leads are available for reassignment

**Expected Results**:
- Order deleted from database
- All leads status: 'unassigned'
- Leads available for new orders
- Operation is atomic (all or nothing)

### 2. Lead Management Tests

#### 2.1 Lead Status Transitions
**Objective**: Verify lead status can be updated correctly

**Test Steps**:
1. Create a lead with 'unassigned' status
2. Update status to 'assigned'
3. Update status to 'fulfilled'
4. Update status back to 'unassigned'
5. Verify each transition is valid

**Expected Results**:
- Status transitions work correctly
- Invalid transitions are rejected
- Timestamps are updated correctly

#### 2.2 State Caps Enforcement
**Objective**: Verify state caps are enforced during lead assignment

**Test Steps**:
1. Set state cap for CA to 2 leads
2. Create orders requesting CA leads
3. Verify only 2 leads are assigned to CA
4. Verify additional orders don't assign more CA leads
5. Verify other states are not affected

**Expected Results**:
- State caps enforced correctly
- No more than cap limit assigned per state
- Other states unaffected
- Clear error messages for cap violations

### 3. Automation Mode Tests

#### 3.1 Plain-text Command Execution
**Objective**: Verify automation commands work correctly

**Test Steps**:
1. Execute 'create_order' command
2. Execute 'fulfill_order' command
3. Execute 'delete_order' command
4. Execute 'get_orders' command
5. Execute 'get_leads' command
6. Execute 'one_time_rule' command

**Expected Results**:
- All commands execute successfully
- Results returned in expected format
- Error handling works for invalid commands
- Commands are idempotent

**API Test**:
```bash
curl -X POST http://localhost:3001/api/automation/execute \
  -H "Content-Type: application/json" \
  -d '{
    "command": "create_order",
    "params": {
      "customer_name": "Auto Customer",
      "customer_email": "auto@example.com"
    }
  }'
```

#### 3.2 One Time Rule Implementation
**Objective**: Verify One Time rule works correctly

**Test Steps**:
1. Create an order
2. Execute One Time rule to fulfill
3. Execute One Time rule to cancel
4. Verify rule actions work correctly
5. Verify error handling for invalid actions

**Expected Results**:
- One Time rule executes successfully
- Order status changes correctly
- Lead status updates correctly
- Error handling for invalid parameters

### 4. Data Integrity Tests

#### 4.1 Concurrency Safety
**Objective**: Verify system handles concurrent operations safely

**Test Steps**:
1. Create multiple orders simultaneously
2. Fulfill orders concurrently
3. Delete orders concurrently
4. Verify no data corruption
5. Verify all operations complete successfully

**Expected Results**:
- No data corruption
- All operations complete successfully
- Database constraints maintained
- No race conditions

#### 4.2 Transaction Atomicity
**Objective**: Verify operations are atomic

**Test Steps**:
1. Simulate database error during order creation
2. Verify partial operations are rolled back
3. Verify data consistency is maintained
4. Test with network interruptions

**Expected Results**:
- Partial operations are rolled back
- Data consistency maintained
- No orphaned records
- Clean error recovery

### 5. Timezone Handling Tests

#### 5.1 Timestamp Display
**Objective**: Verify all timestamps are displayed in America/New_York timezone

**Test Steps**:
1. Create orders and leads
2. Verify created_at timestamps
3. Verify updated_at timestamps
4. Verify fulfilled_at timestamps
5. Check timezone consistency across API responses

**Expected Results**:
- All timestamps in America/New_York timezone
- Consistent timezone formatting
- Proper handling of EST/EDT transitions

### 6. CSV Export Tests

#### 6.1 Fulfilled Orders Export
**Objective**: Verify CSV export works correctly

**Test Steps**:
1. Create and fulfill several orders
2. Export fulfilled orders as CSV
3. Verify CSV format and content
4. Verify all fulfilled orders are included
5. Verify data accuracy

**Expected Results**:
- CSV file generated successfully
- All fulfilled orders included
- Proper CSV formatting
- Data accuracy maintained

### 7. UI/UX Tests

#### 7.1 Dashboard Functionality
**Objective**: Verify dashboard displays correct information

**Test Steps**:
1. Access dashboard
2. Verify lead statistics
3. Verify recent orders display
4. Verify state-by-state breakdown
5. Test pagination and filtering

**Expected Results**:
- Statistics display correctly
- Recent orders shown
- State breakdown accurate
- Pagination works
- Filters work correctly

#### 7.2 Order Management UI
**Objective**: Verify order management interface works

**Test Steps**:
1. Create order via UI
2. Fulfill order via UI
3. Delete order via UI
4. Export CSV via UI
5. Test pagination and filtering

**Expected Results**:
- Order creation works
- Fulfillment works
- Deletion works
- CSV export works
- UI is responsive

## Performance Tests

### 8.1 Load Testing
**Objective**: Verify system performance under load

**Test Steps**:
1. Create 100+ leads
2. Create 50+ orders simultaneously
3. Fulfill orders in batches
4. Monitor response times
5. Verify system stability

**Expected Results**:
- Response times under 2 seconds
- No system crashes
- Database performance maintained
- Memory usage stable

## Error Handling Tests

### 9.1 Invalid Input Handling
**Objective**: Verify system handles invalid inputs gracefully

**Test Steps**:
1. Send invalid JSON
2. Send missing required fields
3. Send invalid status values
4. Send invalid state codes
5. Test with malformed automation commands

**Expected Results**:
- Clear error messages
- No system crashes
- Proper HTTP status codes
- Data integrity maintained

## Test Execution

### Automated Test Script
```bash
#!/bin/bash
# Run comprehensive test suite

echo "Starting Lead Operation System Tests..."

# Start services
docker-compose up -d
sleep 30

# Run API tests
echo "Running API tests..."
./test-api.sh

# Run UI tests
echo "Running UI tests..."
./test-ui.sh

# Run performance tests
echo "Running performance tests..."
./test-performance.sh

# Cleanup
docker-compose down

echo "Tests completed!"
```

### Manual Test Checklist

- [ ] Order creation with lead assignment
- [ ] Manual order fulfillment
- [ ] Order deletion with lead return
- [ ] Lead status management
- [ ] State caps enforcement
- [ ] Automation mode commands
- [ ] One Time rule execution
- [ ] CSV export functionality
- [ ] Dashboard statistics
- [ ] UI responsiveness
- [ ] Error handling
- [ ] Timezone display
- [ ] Concurrency safety
- [ ] Data integrity

## Test Data Cleanup

After testing, clean up test data:
```bash
# Reset database
docker-compose down -v
docker-compose up -d
```

## Success Criteria

All tests must pass for the system to be considered production-ready:

1. **Functional Requirements**: All business logic works correctly
2. **Data Integrity**: No data corruption or inconsistencies
3. **Performance**: Response times under 2 seconds
4. **Reliability**: System handles errors gracefully
5. **Usability**: UI is intuitive and responsive
6. **Automation**: Plain-text commands work correctly
7. **Timezone**: All timestamps display correctly
8. **Export**: CSV export works properly

## Test Reporting

Document all test results including:
- Test case name and description
- Pass/fail status
- Error messages (if any)
- Performance metrics
- Screenshots (for UI tests)
- Recommendations for improvements
