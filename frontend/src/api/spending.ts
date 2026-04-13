import apiClient from './client';
import type { PurchaseHistory, SpendingMetrics, RecordPurchasePayload } from '../types';

export const getSpendingHistory = async (): Promise<PurchaseHistory[]> => {
  const response = await apiClient.get<PurchaseHistory[]>('/spending/history');
  return response.data;
};

export const recordPurchase = async (payload: RecordPurchasePayload): Promise<PurchaseHistory> => {
  const response = await apiClient.post<PurchaseHistory>('/spending/record', payload);
  return response.data;
};

export const getSpendingMetrics = async (): Promise<SpendingMetrics> => {
  const response = await apiClient.get<SpendingMetrics>('/spending/metrics');
  return response.data;
};
