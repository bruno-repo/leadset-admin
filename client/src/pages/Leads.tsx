import React, { useState, useEffect } from 'react';
import { leadAPI } from '../services/api';
import { Lead, LeadStats } from '../services/api';

const Leads: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCapsForm, setShowCapsForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    phone: '',
    state: ''
  });
  const [caps, setCaps] = useState<Record<string, number>>({});

  useEffect(() => {
    loadLeads();
    loadStats();
    loadCaps();
  }, [page, statusFilter, stateFilter]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const response = await leadAPI.getAll(page, 10, statusFilter || undefined, stateFilter || undefined);
      setLeads(response.leads || []);
      setTotalPages(response.pagination?.pages || 1);
    } catch (err) {
      setError('Failed to load leads');
      console.error('Leads error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await leadAPI.getStats();
      setStats(response);
    } catch (err) {
      console.error('Stats error:', err);
    }
  };

  const loadCaps = async () => {
    try {
      const response = await leadAPI.getCaps();
      const capsObj = Object.fromEntries(response.map((cap: any) => [cap.state, cap.max_leads]));
      setCaps(capsObj);
    } catch (err) {
      console.error('Caps error:', err);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await leadAPI.create(createForm);
      setSuccess('Lead created successfully');
      setShowCreateForm(false);
      setCreateForm({ name: '', email: '', phone: '', state: '' });
      loadLeads();
      loadStats();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create lead');
    }
  };

  const handleUpdateStatus = async (id: number, status: Lead['status']) => {
    try {
      setError(null);
      await leadAPI.updateStatus(id, status);
      setSuccess('Lead status updated successfully');
      loadLeads();
      loadStats();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update lead status');
    }
  };

  const handleUpdateCaps = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await leadAPI.updateCaps(caps);
      setSuccess('State caps updated successfully');
      setShowCapsForm(false);
      loadStats();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update state caps');
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

  if (loading) {
    return <div className="loading">Loading leads...</div>;
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">Leads</h1>
          <div>
            <button 
              className="btn btn-primary" 
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              Create Lead
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => setShowCapsForm(!showCapsForm)}
              style={{ marginLeft: '10px' }}
            >
              Manage State Caps
            </button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        {showCreateForm && (
          <form onSubmit={handleCreateLead} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '5px' }}>
            <h3>Create New Lead</h3>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                type="text"
                className="form-control"
                value={createForm.name}
                onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                value={createForm.email}
                onChange={(e) => setCreateForm({...createForm, email: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="text"
                className="form-control"
                value={createForm.phone}
                onChange={(e) => setCreateForm({...createForm, phone: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label className="form-label">State</label>
              <input
                type="text"
                className="form-control"
                value={createForm.state}
                onChange={(e) => setCreateForm({...createForm, state: e.target.value.toUpperCase()})}
                placeholder="CA, NY, TX, etc."
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">Create Lead</button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setShowCreateForm(false)}
              style={{ marginLeft: '10px' }}
            >
              Cancel
            </button>
          </form>
        )}

        {showCapsForm && (
          <form onSubmit={handleUpdateCaps} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '5px' }}>
            <h3>Manage State Caps</h3>
            {Object.entries(caps).map(([state, maxLeads]) => (
              <div key={state} className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label className="form-label" style={{ minWidth: '50px' }}>{state}:</label>
                <input
                  type="number"
                  className="form-control"
                  value={maxLeads}
                  onChange={(e) => setCaps({...caps, [state]: parseInt(e.target.value) || 0})}
                  min="0"
                  style={{ width: '100px' }}
                />
              </div>
            ))}
            <button type="submit" className="btn btn-primary">Update Caps</button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setShowCapsForm(false)}
              style={{ marginLeft: '10px' }}
            >
              Cancel
            </button>
          </form>
        )}

        <div style={{ marginBottom: '1rem', display: 'flex', gap: '10px' }}>
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '150px' }}
          >
            <option value="">All Statuses</option>
            <option value="unassigned">Unassigned</option>
            <option value="assigned">Assigned</option>
            <option value="fulfilled">Fulfilled</option>
          </select>
          <select
            className="form-control"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            style={{ width: '150px' }}
          >
            <option value="">All States</option>
            {Object.keys(caps).map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>

        {leads.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>State</th>
                  <th>Status</th>
                  <th>Order ID</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.id}</td>
                    <td>{lead.name}</td>
                    <td>{lead.email}</td>
                    <td>{lead.phone || '-'}</td>
                    <td>{lead.state}</td>
                    <td>
                      <span className={`status-badge status-${lead.status}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td>{lead.order_id || '-'}</td>
                    <td>{lead.created_at}</td>
                    <td>
                      {lead.status === 'assigned' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleUpdateStatus(lead.id, 'fulfilled')}
                        >
                          Mark Fulfilled
                        </button>
                      )}
                      {lead.status === 'fulfilled' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleUpdateStatus(lead.id, 'unassigned')}
                        >
                          Return to Stock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No leads found</p>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {stats && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Lead Statistics</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Unassigned</th>
                  <th>Assigned</th>
                  <th>Fulfilled</th>
                  <th>Total</th>
                  <th>Cap</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byState).map(([state, stateStats]) => {
                  const total = Object.values(stateStats).reduce((sum, count) => sum + count, 0);
                  const cap = stats.stateCaps[state] || 10;
                  return (
                    <tr key={state}>
                      <td><strong>{state}</strong></td>
                      <td>{stateStats.unassigned || 0}</td>
                      <td>{stateStats.assigned || 0}</td>
                      <td>{stateStats.fulfilled || 0}</td>
                      <td>{total}</td>
                      <td>{cap}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leads;
