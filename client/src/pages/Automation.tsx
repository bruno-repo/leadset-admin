import React, { useState, useEffect } from 'react';
import { automationAPI } from '../services/api';

const Automation: React.FC = () => {
  const [command, setCommand] = useState('');
  const [params, setParams] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    type: '',
    config: ''
  });

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const response = await automationAPI.getRules();
      setRules(response);
    } catch (err) {
      console.error('Rules error:', err);
    }
  };

  const handleExecuteCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      
      let parsedParams = {};
      if (params.trim()) {
        try {
          parsedParams = JSON.parse(params);
        } catch (err) {
          // If JSON parsing fails, treat as simple key-value pairs
          const lines = params.split('\n').filter(line => line.trim());
          parsedParams = Object.fromEntries(
            lines.map(line => {
              const [key, ...valueParts] = line.split(':');
              const value = valueParts.join(':').trim();
              // Convert numeric values to numbers
              const numericValue = !isNaN(Number(value)) && value !== '' ? Number(value) : value;
              return [key.trim(), numericValue];
            })
          );
        }
      }

      const response = await automationAPI.execute(command, parsedParams);
      setResult(response);
      setSuccess('Command executed successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to execute command');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      let parsedConfig = {};
      if (ruleForm.config.trim()) {
        parsedConfig = JSON.parse(ruleForm.config);
      }
      
      await automationAPI.createRule({
        name: ruleForm.name,
        type: ruleForm.type,
        config: parsedConfig
      });
      
      setSuccess('Rule created successfully');
      setShowRuleForm(false);
      setRuleForm({ name: '', type: '', config: '' });
      loadRules();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create rule');
    }
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  useEffect(() => {
    const timer = setTimeout(clearMessages, 5000);
    return () => clearTimeout(timer);
  }, [error, success]);

  const predefinedCommands = [
    { command: 'create_order', description: 'Create a new order', example: 'customer_name: John Doe\ncustomer_email: john@example.com' },
    { command: 'fulfill_order', description: 'Fulfill an order', example: 'orderId: 1' },
    { command: 'delete_order', description: 'Delete an order', example: 'orderId: 1' },
    { command: 'get_orders', description: 'Get orders', example: 'status: fulfilled\nlimit: 10' },
    { command: 'get_leads', description: 'Get leads', example: 'status: unassigned\nstate: CA' },
    { command: 'one_time_rule', description: 'Execute One Time rule', example: 'orderId: 1\naction: fulfill' }
  ];

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">Automation Mode</h1>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowRuleForm(!showRuleForm)}
          >
            Create Rule
          </button>
        </div>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        {showRuleForm && (
          <form onSubmit={handleCreateRule} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '5px' }}>
            <h3>Create Automation Rule</h3>
            <div className="form-group">
              <label className="form-label">Rule Name</label>
              <input
                type="text"
                className="form-control"
                value={ruleForm.name}
                onChange={(e) => setRuleForm({...ruleForm, name: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Rule Type</label>
              <input
                type="text"
                className="form-control"
                value={ruleForm.type}
                onChange={(e) => setRuleForm({...ruleForm, type: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Configuration (JSON)</label>
              <textarea
                className="form-control"
                value={ruleForm.config}
                onChange={(e) => setRuleForm({...ruleForm, config: e.target.value})}
                rows={4}
                placeholder='{"key": "value"}'
              />
            </div>
            <button type="submit" className="btn btn-primary">Create Rule</button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setShowRuleForm(false)}
              style={{ marginLeft: '10px' }}
            >
              Cancel
            </button>
          </form>
        )}

        <form onSubmit={handleExecuteCommand} style={{ marginBottom: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Command</label>
            <select
              className="form-control"
              value={command}
              onChange={(e) => {
                setCommand(e.target.value);
                const predefined = predefinedCommands.find(cmd => cmd.command === e.target.value);
                if (predefined) {
                  setParams(predefined.example);
                }
              }}
              required
            >
              <option value="">Select a command...</option>
              {predefinedCommands.map((cmd, index) => (
                <option key={index} value={cmd.command}>
                  {cmd.command} - {cmd.description}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Parameters (key: value format, one per line)</label>
            <textarea
              className="form-control"
              value={params}
              onChange={(e) => setParams(e.target.value)}
              rows={6}
              placeholder="customer_name: John Doe&#10;customer_email: john@example.com&#10;requested_states: CA,NY,TX"
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
          >
            {loading ? 'Executing...' : 'Execute Command'}
          </button>
        </form>

        {result && (
          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="card-header">
              <h3 className="card-title">Command Result</h3>
            </div>
            <pre style={{ 
              background: '#f8f9fa', 
              padding: '1rem', 
              borderRadius: '5px', 
              overflow: 'auto',
              whiteSpace: 'pre-wrap'
            }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Automation Rules</h2>
        </div>
        {rules.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Active</th>
                  <th>Config</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.id}</td>
                    <td>{rule.name}</td>
                    <td>{rule.type}</td>
                    <td>
                      <span className={`status-badge ${rule.active ? 'status-fulfilled' : 'status-cancelled'}`}>
                        {rule.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <pre style={{ fontSize: '0.8rem', margin: 0 }}>
                        {JSON.stringify(rule.config, null, 2)}
                      </pre>
                    </td>
                    <td>{new Date(rule.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No automation rules found</p>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Available Commands</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Command</th>
                <th>Description</th>
                <th>Example Parameters</th>
              </tr>
            </thead>
            <tbody>
              {predefinedCommands.map((cmd, index) => (
                <tr key={index}>
                  <td><code>{cmd.command}</code></td>
                  <td>{cmd.description}</td>
                  <td>
                    <pre style={{ fontSize: '0.8rem', margin: 0, whiteSpace: 'pre-wrap' }}>
                      {cmd.example}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Automation;
