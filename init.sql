-- Initialize database with sample data
-- This file is executed when the PostgreSQL container starts

-- Create sample leads data
INSERT INTO leads (name, email, phone, state, status) VALUES
('John Smith', 'john.smith@email.com', '555-0101', 'CA', 'unassigned'),
('Jane Doe', 'jane.doe@email.com', '555-0102', 'CA', 'unassigned'),
('Bob Johnson', 'bob.johnson@email.com', '555-0103', 'NY', 'unassigned'),
('Alice Brown', 'alice.brown@email.com', '555-0104', 'NY', 'unassigned'),
('Charlie Wilson', 'charlie.wilson@email.com', '555-0105', 'TX', 'unassigned'),
('Diana Davis', 'diana.davis@email.com', '555-0106', 'TX', 'unassigned'),
('Eve Miller', 'eve.miller@email.com', '555-0107', 'FL', 'unassigned'),
('Frank Garcia', 'frank.garcia@email.com', '555-0108', 'FL', 'unassigned'),
('Grace Lee', 'grace.lee@email.com', '555-0109', 'IL', 'unassigned'),
('Henry Taylor', 'henry.taylor@email.com', '555-0110', 'IL', 'unassigned'),
('Ivy Chen', 'ivy.chen@email.com', '555-0111', 'CA', 'unassigned'),
('Jack Anderson', 'jack.anderson@email.com', '555-0112', 'NY', 'unassigned'),
('Kate White', 'kate.white@email.com', '555-0113', 'TX', 'unassigned'),
('Leo Martinez', 'leo.martinez@email.com', '555-0114', 'FL', 'unassigned'),
('Mia Thompson', 'mia.thompson@email.com', '555-0115', 'IL', 'unassigned');

-- Create sample automation rules
INSERT INTO automation_rules (name, type, config, active) VALUES
('One Time Rule', 'one_time', '{"description": "Execute one-time operations on orders"}', true),
('Auto Fulfillment', 'auto_fulfill', '{"conditions": {"status": "pending", "age_hours": 24}}', false),
('Lead Reassignment', 'lead_reassign', '{"max_retries": 3, "retry_interval_hours": 2}', false);
