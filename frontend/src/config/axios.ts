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
      const token = await getToken();
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      return config;
    });

    // Cleanup interceptor on unmount
    return () => {
      api.interceptors.request.eject(interceptor);
    };
  }, [getToken]);
};

export default api; 