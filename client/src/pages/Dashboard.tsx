import React, { useState, useEffect } from 'react';
import { leadAPI, orderAPI } from '../services/api';
import { LeadStats, Order } from '../services/api';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsResponse, ordersResponse] = await Promise.all([
        leadAPI.getStats(),
        orderAPI.getAll(1, 5)
      ]);
      
      setStats(statsResponse);
      setRecentOrders(ordersResponse.orders || []);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div>
      <h1>Dashboard</h1>
      
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.byStatus.unassigned || 0}</div>
            <div className="stat-label">Unassigned Leads</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.byStatus.assigned || 0}</div>
            <div className="stat-label">Assigned Leads</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.byStatus.fulfilled || 0}</div>
            <div className="stat-label">Fulfilled Leads</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {Object.values(stats.byStatus).reduce((sum, count) => sum + count, 0)}
            </div>
            <div className="stat-label">Total Leads</div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Lead Status by State</h2>
        </div>
        {stats && (
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
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent Orders</h2>
        </div>
        {recentOrders.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Leads</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.id}</td>
                    <td>{order.customer_name}</td>
                    <td>
                      <span className={`status-badge status-${order.status}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>{order.lead_count || 0}</td>
                    <td>{order.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No recent orders</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
