import React, { useState, useEffect } from 'react';
import { orderAPI } from '../services/api';
import { Order } from '../services/api';

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    customer_name: '',
    customer_email: '',
    requested_states: ['CA', 'NY', 'TX', 'FL', 'IL']
  });

  useEffect(() => {
    loadOrders();
  }, [page, statusFilter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await orderAPI.getAll(page, 10, statusFilter || undefined);
      setOrders(response.orders || []);
      setTotalPages(response.pagination?.pages || 1);
    } catch (err) {
      setError('Failed to load orders');
      console.error('Orders error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const response = await orderAPI.create(createForm);
      setSuccess(`Order created successfully with ${response.assignedLeads.length} leads assigned`);
      setShowCreateForm(false);
      setCreateForm({
        customer_name: '',
        customer_email: '',
        requested_states: ['CA', 'NY', 'TX', 'FL', 'IL']
      });
      loadOrders();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create order');
    }
  };

  const handleFulfillOrder = async (id: number) => {
    try {
      setError(null);
      await orderAPI.fulfill(id);
      setSuccess('Order fulfilled successfully');
      loadOrders();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fulfill order');
    }
  };

  const handleDeleteOrder = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this order? Leads will be returned to stock.')) {
      return;
    }

    try {
      setError(null);
      await orderAPI.delete(id);
      setSuccess('Order deleted and leads returned to stock');
      loadOrders();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete order');
    }
  };

  const handleExportCSV = async () => {
    try {
      setError(null);
      const blob = await orderAPI.exportCSV();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fulfilled_orders.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSuccess('CSV exported successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to export CSV');
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
    return <div className="loading">Loading orders...</div>;
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">Orders</h1>
          <div>
            <button 
              className="btn btn-primary" 
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              Create Order
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={handleExportCSV}
              style={{ marginLeft: '10px' }}
            >
              Export CSV
            </button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        {showCreateForm && (
          <form onSubmit={handleCreateOrder} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '5px' }}>
            <h3>Create New Order</h3>
            <div className="form-group">
              <label className="form-label">Customer Name</label>
              <input
                type="text"
                className="form-control"
                value={createForm.customer_name}
                onChange={(e) => setCreateForm({...createForm, customer_name: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Customer Email</label>
              <input
                type="email"
                className="form-control"
                value={createForm.customer_email}
                onChange={(e) => setCreateForm({...createForm, customer_email: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Requested States (comma-separated)</label>
              <input
                type="text"
                className="form-control"
                value={createForm.requested_states.join(', ')}
                onChange={(e) => setCreateForm({...createForm, requested_states: e.target.value.split(',').map(s => s.trim())})}
                placeholder="CA, NY, TX, FL, IL"
              />
            </div>
            <button type="submit" className="btn btn-primary">Create Order</button>
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

        <div style={{ marginBottom: '1rem' }}>
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '200px', display: 'inline-block' }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {orders.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Leads</th>
                  <th>States</th>
                  <th>Created</th>
                  <th>Fulfilled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.id}</td>
                    <td>{order.customer_name}</td>
                    <td>{order.customer_email}</td>
                    <td>
                      <span className={`status-badge status-${order.status}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>{order.lead_count || 0}</td>
                    <td>{order.states?.join(', ') || '-'}</td>
                    <td>{order.created_at}</td>
                    <td>{order.fulfilled_at || '-'}</td>
                    <td>
                      {order.status === 'pending' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleFulfillOrder(order.id)}
                        >
                          Fulfill
                        </button>
                      )}
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteOrder(order.id)}
                        style={{ marginLeft: '5px' }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No orders found</p>
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
    </div>
  );
};

export default Orders;
