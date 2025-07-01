import axios from 'axios';
import { getSession, signOut } from 'next-auth/react';

if (!process.env.NEXT_PUBLIC_API_URL) {
  throw new Error(
    'NEXT_PUBLIC_API_URL is not defined. Please set it in your environment variables.'
  );
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// build test

// Request Interceptor - attach token
api.interceptors.request.use(
  async (config) => {
    const session = await getSession();

    if (session?.user?.email) {
      config.headers = config.headers || {};
      config.headers['user-email'] = session.user.email;
    }

    if (session?.idToken) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${session.idToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor - logout on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      console.warn('Token expired or unauthorized. Logging out...');
      await signOut({ callbackUrl: '/' });
    }

    return Promise.reject(error);
  }
);

export default api;
