import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('请求超时，请稍后重试');
    } else if (!error.response) {
      console.error('网络错误，请检查连接');
    } else {
      if (error.response.status === 401) {
        localStorage.removeItem('token');
        window.location.reload();
      }
      console.error(`请求失败 (${error.response.status}):`, error.response.data);
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email, password) => api.post('/login', { email, password }),
  guestLogin: () => api.post('/login/guest'),
  getMe: (token) => api.get('/me', { params: { token } }),
  logout: () => api.post('/logout'),
};

export default api;
