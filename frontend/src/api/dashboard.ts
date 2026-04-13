import apiClient from './client';
import type { DashboardData } from '../types';

export const getDashboard = async (): Promise<DashboardData> => {
  const r = await apiClient.get<DashboardData>('/dashboard');
  return r.data;
};
