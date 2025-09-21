import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface Lead {
  id: number;
  name: string;
  email: string;
  phone?: string;
  state: string;
  status: 'unassigned' | 'assigned' | 'fulfilled';
  order_id?: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: number;
  customer_name: string;
  customer_email: string;
  status: 'pending' | 'fulfilled' | 'cancelled';
  created_at: string;
  updated_at: string;
  fulfilled_at?: string;
  lead_count?: number;
  states?: string[];
  leads?: Lead[];
}

export interface OrderCreateRequest {
  customer_name: string;
  customer_email: string;
  requested_states?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface LeadStats {
  byStatus: Record<string, number>;
  byState: Record<string, Record<string, number>>;
  stateCaps: Record<string, number>;
}

// Order API
export const orderAPI = {
  create: async (data: OrderCreateRequest) => {
    const response = await api.post('/orders', data);
    return response.data;
  },

  getAll: async (page = 1, limit = 10, status?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(status && { status }),
    });
    const response = await api.get(`/orders?${params}`);
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },

  fulfill: async (id: number) => {
    const response = await api.patch(`/orders/${id}/fulfill`);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/orders/${id}`);
    return response.data;
  },

  exportCSV: async () => {
    const response = await api.get('/orders/export/csv', {
      responseType: 'blob',
    });
    return response.data;
  },
};

// Lead API
export const leadAPI = {
  getAll: async (page = 1, limit = 10, status?: string, state?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(status && { status }),
      ...(state && { state }),
    });
    const response = await api.get(`/leads?${params}`);
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/leads/stats');
    return response.data;
  },

  create: async (data: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'status' | 'order_id'>) => {
    const response = await api.post('/leads', data);
    return response.data;
  },

  updateStatus: async (id: number, status: Lead['status']) => {
    const response = await api.patch(`/leads/${id}/status`, { status });
    return response.data;
  },

  getCaps: async () => {
    const response = await api.get('/leads/caps');
    return response.data;
  },

  updateCaps: async (caps: Record<string, number>) => {
    const response = await api.put('/leads/caps', { caps });
    return response.data;
  },
};

// Automation API
export const automationAPI = {
  execute: async (command: string, params: any = {}) => {
    const response = await api.post('/automation/execute', { command, params });
    return response.data;
  },

  getRules: async () => {
    const response = await api.get('/automation/rules');
    return response.data;
  },

  createRule: async (data: { name: string; type: string; config: any }) => {
    const response = await api.post('/automation/rules', data);
    return response.data;
  },
};

export default api;
