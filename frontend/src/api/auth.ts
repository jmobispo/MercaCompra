import apiClient from './client';
import type { AuthResponse, User } from '../types';

export const register = async (
  email: string,
  username: string,
  password: string,
  postal_code: string
): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/auth/register', {
    email,
    username,
    password,
    postal_code,
  });
  return response.data;
};

export const login = async (
  email: string,
  password: string
): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/auth/login', {
    email,
    password,
  });
  return response.data;
};

export const getMe = async (): Promise<User> => {
  const response = await apiClient.get<User>('/auth/me');
  return response.data;
};

export const updateMe = async (data: Partial<Pick<User, 'username' | 'postal_code' | 'ui_mode'>>): Promise<User> => {
  const response = await apiClient.put<User>('/auth/me', data);
  return response.data;
};
