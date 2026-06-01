import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

export const assignmentsApi = {
  getAll: () => api.get('/assignments'),
  getById: (id: string) => api.get(`/assignments/${id}`),
  create: (data: any) => api.post('/assignments', data),
  delete: (id: string) => api.delete(`/assignments/${id}`),
  getResult: (id: string) => api.get(`/assignments/${id}/result`),
  regenerate: (id: string) => api.post(`/assignments/${id}/regenerate`),
};
