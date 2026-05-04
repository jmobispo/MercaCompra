import apiClient from './client';
import type { AuthResponse, User } from '../types';

export interface UpdateMePayload {
  username?: string;
  postal_code?: string;
  ui_mode?: 'basic' | 'advanced';
  theme_mode?: 'light' | 'dark';
  accent_color?: string;
  ai_enabled?: boolean;
  ai_provider?: string;
  ai_model?: string;
  ai_api_key?: string;
  clear_ai_api_key?: boolean;
  ai_recipe_autofill?: boolean;
  ai_list_assist?: boolean;
  ai_plan_assist?: boolean;
}

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

export const updateMe = async (data: UpdateMePayload): Promise<User> => {
  const response = await apiClient.put<User>('/auth/me', data);
  return response.data;
};
