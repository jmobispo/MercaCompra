import apiClient from './client';
import type { AutomationRun, LaunchAutomationPayload } from '../types';

export const launchAutomation = async (payload: LaunchAutomationPayload): Promise<AutomationRun> => {
  const response = await apiClient.post<AutomationRun>('/automation/runs', payload);
  return response.data;
};

export const getRuns = async (): Promise<AutomationRun[]> => {
  const response = await apiClient.get<AutomationRun[]>('/automation/runs');
  return response.data;
};

export const getRun = async (id: number): Promise<AutomationRun> => {
  const response = await apiClient.get<AutomationRun>(`/automation/runs/${id}`);
  return response.data;
};
