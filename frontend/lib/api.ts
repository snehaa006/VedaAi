import axios from 'axios';

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
const isBrowser = typeof window !== 'undefined';
const isDeployedBrowser =
  isBrowser && !['localhost', '127.0.0.1'].includes(window.location.hostname);

const API_BASE =
  isDeployedBrowser && configuredApiUrl?.includes('localhost')
    ? `${window.location.origin}/_/backend/api`
    : configuredApiUrl ||
      (isBrowser ? `${window.location.origin}/_/backend/api` : 'http://localhost:3001/api');

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
