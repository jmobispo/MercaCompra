import apiClient from './client';
import type { DemoStatus, DemoSeedResult } from '../types';

export const getDemoStatus = async (): Promise<DemoStatus> => {
  const r = await apiClient.get<DemoStatus>('/demo/status');
  return r.data;
};

export const seedDemo = async (): Promise<DemoSeedResult> => {
  const r = await apiClient.post<DemoSeedResult>('/demo/seed');
  return r.data;
};
