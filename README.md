# Lead Operation System

A comprehensive lead management system with automated order processing, state-based lead caps, and automation capabilities.

## Features

### Order Management
- **Automatic Lead Assignment**: Pulls from unassigned leads, assigns oldest leads first
- **State Caps Enforcement**: Respects per-state lead limits
- **Manual Fulfillment**: Allows manual order fulfillment
- **Order Deletion**: Returns assigned leads to stock
- **Pagination**: Efficient listing of orders with pagination
- **Timezone Support**: All timestamps displayed in America/New_York timezone
- **CSV Export**: Export fulfilled orders as CSV

### Automation
- **Plain-text Automation Mode**: Execute operations without UI
- **One Time Rule**: Implemented automation rule for one-time operations
- **Custom Rules**: Create and manage automation rules

### Reliability
- **Concurrency Safety**: Database transactions ensure data consistency
- **Idempotent Operations**: Safe to retry operations
- **Error Handling**: Comprehensive error handling and logging

## Technology Stack

- **Backend**: Node.js with Express
- **Frontend**: React with TypeScript
- **Database**: PostgreSQL
- **Deployment**: Docker & Docker Compose

## Quick Start

### Using Docker (Recommended)

1. **Clone and navigate to the project**:
   ```bash
   git clone <repository-url>
   cd Lead-Operation
   ```

2. **Start the application**:
   ```bash
   docker-compose up -d
   ```

3. **Access the application**:
   - Web UI: http://localhost:3001
   - API Health: http://localhost:3001/health

### Local Development

1. **Prerequisites**:
   - Node.js 18+
   - PostgreSQL 12+
   - npm or yarn

2. **Install dependencies**:
   ```bash
   npm run install-all
   ```

3. **Set up environment**:
   ```bash
   cp env.example .env
   # Edit .env with your database credentials
   ```

4. **Start PostgreSQL** and create database:
   ```sql
   CREATE DATABASE lead_operation;
   ```

5. **Start the application**:
   ```bash
   npm run dev
   ```

## API Endpoints

### Orders
- `POST /api/orders` - Create order with automatic lead assignment
- `GET /api/orders` - List orders with pagination and filtering
- `GET /api/orders/:id` - Get order details with assigned leads
- `PATCH /api/orders/:id/fulfill` - Manually fulfill an order
- `DELETE /api/orders/:id` - Delete order and return leads to stock
- `GET /api/orders/export/csv` - Export fulfilled orders as CSV

### Leads
- `GET /api/leads` - List leads with pagination and filtering
- `POST /api/leads` - Create new lead
- `PATCH /api/leads/:id/status` - Update lead status
- `GET /api/leads/stats` - Get lead statistics
- `GET /api/leads/caps` - Get state caps
- `PUT /api/leads/caps` - Update state caps

### Automation
- `POST /api/automation/execute` - Execute automation command
- `GET /api/automation/rules` - List automation rules
- `POST /api/automation/rules` - Create automation rule

## Automation Mode Usage

The system provides a plain-text automation mode for performing operations without the UI:

### Available Commands

1. **create_order**
   ```json
   {
     "command": "create_order",
     "params": {
       "customer_name": "John Doe",
       "customer_email": "john@example.com",
       "requested_states": ["CA", "NY", "TX"]
     }
   }
   ```

2. **fulfill_order**
   ```json
   {
     "command": "fulfill_order",
     "params": {
       "orderId": 1
     }
   }
   ```

3. **delete_order**
   ```json
   {
     "command": "delete_order",
     "params": {
       "orderId": 1
     }
   }
   ```

4. **get_orders**
   ```json
   {
     "command": "get_orders",
     "params": {
       "status": "fulfilled",
       "limit": 10
     }
   }
   ```

5. **get_leads**
   ```json
   {
     "command": "get_leads",
     "params": {
       "status": "unassigned",
       "state": "CA"
     }
   }
   ```

6. **one_time_rule**
   ```json
   {
     "command": "one_time_rule",
     "params": {
       "orderId": 1,
       "action": "fulfill"
     }
   }
   ```

## Database Schema

### Tables

- **leads**: Lead information with status tracking
- **orders**: Order management with customer details
- **state_caps**: Per-state lead limits
- **automation_rules**: Automation rule configurations

### Key Features

- **Automatic Timestamps**: All tables include created_at and updated_at
- **Timezone Support**: All timestamps stored in UTC, displayed in America/New_York
- **Status Tracking**: Comprehensive status tracking for leads and orders
- **Referential Integrity**: Foreign key relationships maintained

## State Caps Management

The system enforces per-state lead limits:

- Default cap: 10 leads per state
- Configurable via API or UI
- Automatic enforcement during order creation
- Real-time statistics available

## Concurrency and Atomicity

### Database Transactions
All critical operations use database transactions to ensure atomicity:

- **Order Creation**: Atomic lead assignment with state cap checking
- **Order Fulfillment**: Atomic status updates across orders and leads
- **Order Deletion**: Atomic lead return to stock
- **Lead Status Updates**: Atomic status transitions

### Idempotency
All operations are designed to be idempotent:

- **Duplicate Prevention**: Unique constraints prevent duplicate operations
- **Status Checks**: Operations verify current state before execution
- **Safe Retries**: Failed operations can be safely retried

### Concurrency Safety
- **Row-level Locking**: Database handles concurrent access
- **Transaction Isolation**: ACID properties ensure data consistency
- **Optimistic Locking**: Version-based conflict detection

## Testing

### Test Plan

1. **Unit Tests**
   - API endpoint testing
   - Database operation testing
   - Business logic validation

2. **Integration Tests**
   - End-to-end order creation
   - Lead assignment workflows
   - Automation rule execution

3. **Performance Tests**
   - Concurrent order creation
   - Large dataset handling
   - Database query optimization

### Running Tests

```bash
# Backend tests
npm test

# Frontend tests
cd client && npm test

# Integration tests
npm run test:integration
```

## Deployment

### Production Considerations

1. **Environment Variables**
   - Database credentials
   - API keys and secrets
   - Timezone configuration

2. **Database Setup**
   - PostgreSQL configuration
   - Connection pooling
   - Backup strategies

3. **Monitoring**
   - Health check endpoints
   - Log aggregation
   - Performance monitoring

### Docker Production

```bash
# Build production image
docker build -t lead-operation .

# Run with environment variables
docker run -e DB_HOST=your-db-host -e DB_PASSWORD=your-password lead-operation
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create an issue in the repository
- Check the documentation
- Review the API endpoints
- Test with the automation mode
