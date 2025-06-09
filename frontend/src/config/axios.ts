import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import { useEffect } from 'react';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

// Create a custom hook for setting up the auth interceptor
export const useAuthInterceptor = () => {
  const { getToken } = useAuth();

  useEffect(() => {
    const interceptor = api.interceptors.request.use(async (config) => {
      try {
        console.log('Getting token from Clerk...', config.url);
        const token = await getToken();
        
        if (token) {
          console.log('Token obtained successfully:', token.slice(0, 10) + '...');
          config.headers.Authorization = `Bearer ${token}`;
        } else {
          console.warn('No token available from Clerk - this might indicate you are not properly signed in');
        }
        
        return config;
      } catch (error) {
        console.error('Error getting token:', error);
        throw error; // Rethrow to trigger the error handler
      }
    }, (error) => {
      console.error('Request interceptor error:', error);
      return Promise.reject(error);
    });

    // Add response interceptor to log auth-related errors
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          console.error('Authentication error:', {
            status: error.response.status,
            headers: error.response.headers,
            data: error.response.data
          });
        }
        return Promise.reject(error);
      }
    );

    // Cleanup interceptors on unmount
    return () => {
      api.interceptors.request.eject(interceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [getToken]);
};

export default api; 