import apiClient from './client';
import type {
  AddToListResult,
  CreateWeeklyPlanPayload,
  GenerateWeeklyPlanListPayload,
  UpdateWeeklyPlanPayload,
  WeeklyPlan,
  WeeklyPlanSummary,
} from '../types';

export const getWeeklyPlans = async (): Promise<WeeklyPlanSummary[]> => {
  const response = await apiClient.get<WeeklyPlanSummary[]>('/weekly-plans');
  return response.data;
};

export const getWeeklyPlan = async (id: number): Promise<WeeklyPlan> => {
  const response = await apiClient.get<WeeklyPlan>(`/weekly-plans/${id}`);
  return response.data;
};

export const createWeeklyPlan = async (payload: CreateWeeklyPlanPayload): Promise<WeeklyPlan> => {
  const response = await apiClient.post<WeeklyPlan>('/weekly-plans', payload);
  return response.data;
};

export const updateWeeklyPlan = async (id: number, payload: UpdateWeeklyPlanPayload): Promise<WeeklyPlan> => {
  const response = await apiClient.put<WeeklyPlan>(`/weekly-plans/${id}`, payload);
  return response.data;
};

export const deleteWeeklyPlan = async (id: number): Promise<void> => {
  await apiClient.delete(`/weekly-plans/${id}`);
};

export const generateWeeklyPlanShoppingList = async (
  id: number,
  payload: GenerateWeeklyPlanListPayload
): Promise<AddToListResult> => {
  const response = await apiClient.post<AddToListResult>(`/weekly-plans/${id}/generate-shopping-list`, payload);
  return response.data;
};
