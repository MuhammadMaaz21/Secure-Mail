import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
});

// Check if token is expired or expiring soon
const isTokenExpiringSoon = () => {
  const expiresAt = localStorage.getItem('tokenExpiresAt');
  if (!expiresAt) return true;
  const now = Date.now();
  const expiresIn = parseInt(expiresAt) - now;
  return expiresIn < 5 * 60 * 1000; // Less than 5 minutes
};

// Token refresh mutex to prevent concurrent refreshes
let refreshTokenPromise = null;

// Refresh token function with mutex
const refreshToken = async () => {
  // If refresh is already in progress, return the existing promise
  if (refreshTokenPromise) {
    return refreshTokenPromise;
  }

  const refreshTokenValue = localStorage.getItem('refreshToken');
  if (!refreshTokenValue) {
    throw new Error('No refresh token available');
  }

  // Create refresh promise
  refreshTokenPromise = (async () => {
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/auth/refresh`, {
        refreshToken: refreshTokenValue
      });

      const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data.data;
      
      localStorage.setItem('jwt', accessToken);
      localStorage.setItem('refreshToken', newRefreshToken);
      localStorage.setItem('tokenExpiresAt', Date.now() + expiresIn * 1000);

      return accessToken;
    } catch (error) {
      // Clear tokens on refresh failure
      localStorage.removeItem('jwt');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('tokenExpiresAt');
      localStorage.removeItem('user');
      throw error;
    } finally {
      // Clear the promise after completion
      refreshTokenPromise = null;
    }
  })();

  return refreshTokenPromise;
};

// List of public endpoints that don't require authentication
const publicEndpoints = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/refresh'
];

// Check if endpoint is public
const isPublicEndpoint = (url) => {
  return publicEndpoints.some(endpoint => url.includes(endpoint));
};

// Attach JWT from localStorage and handle token refresh
api.interceptors.request.use(
  async (config) => {
    // Skip token refresh for public endpoints
    if (isPublicEndpoint(config.url)) {
      // Don't add auth header for public endpoints
      return config;
    }

    // Check if token needs refresh before making request
    if (isTokenExpiringSoon()) {
      try {
        await refreshToken();
      } catch (error) {
        // If refresh fails, redirect will happen in response interceptor
        console.error('Token refresh failed:', error);
      }
    }

    const token = localStorage.getItem('jwt');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Error interceptor - handle 401 and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip token refresh for public endpoints
    if (isPublicEndpoint(originalRequest.url)) {
      // Return error response data if available
      if (error.response && error.response.data) {
        return Promise.reject(error.response.data);
      }
      return Promise.reject({ message: error.message });
    }

    // If 401 and not already retried, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await refreshToken();
        // Retry original request with new token
        const token = localStorage.getItem('jwt');
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Redirect to login on refresh failure
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // Return error response data if available
    if (error.response && error.response.data) {
      return Promise.reject(error.response.data);
    }
    return Promise.reject({ message: error.message });
  }
);

export default api;
