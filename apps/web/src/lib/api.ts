import axios from 'axios';

const resolveBaseUrl = () => {
  const envBase = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envBase) return envBase;

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001';
    }
    return `${protocol}//api.${hostname.replace(/^www\./, '')}`;
  }

  return 'http://localhost:3001';
};

export const apiClient = axios.create({ baseURL: `${resolveBaseUrl()}/api` });

apiClient.interceptors.request.use((cfg) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('hotel_token');
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

apiClient.interceptors.response.use(
  (res) => res.data, // returns { ok, data, meta }
  (err) => {
    const requestUrl = String(err.config?.url ?? '');
    const isPublicEndpoint = requestUrl.startsWith('/public/') || requestUrl.includes('/api/public/');
    if (err.response?.status === 401 && typeof window !== 'undefined' && !isPublicEndpoint) {
      localStorage.removeItem('hotel_token');
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data ?? err);
  },
);

// Typed wrappers – each returns the raw server response { ok, data, meta }
export const api = {
  get:    (url: string, params?: Record<string, any>) => apiClient.get(url, { params }) as Promise<any>,
  post:   (url: string, body?: any)                   => apiClient.post(url, body) as Promise<any>,
  postForm: (url: string, body: FormData)             => apiClient.post(url, body, { headers: { 'Content-Type': 'multipart/form-data' } }) as Promise<any>,
  patch:  (url: string, body?: any)                   => apiClient.patch(url, body) as Promise<any>,
  del:    (url: string)                               => apiClient.delete(url) as Promise<any>,
};
