import { ApiResponse, CapabilityEvent, RuntimeStatusResponse } from '../../types';
import { httpClient } from './base';

export const runtimeApi = {
  getStatus: (): Promise<ApiResponse<RuntimeStatusResponse>> =>
    httpClient.get<RuntimeStatusResponse>('/runtime/status'),
  getEvents: (
    params?: { capability?: string; limit?: number }
  ): Promise<ApiResponse<{ events: CapabilityEvent[] }>> => {
    const searchParams = new URLSearchParams();
    if (params?.capability) {
      searchParams.set('capability', params.capability);
    }
    if (typeof params?.limit === 'number') {
      searchParams.set('limit', String(params.limit));
    }
    const query = searchParams.toString();
    return httpClient.get<{ events: CapabilityEvent[] }>(
      query ? `/runtime/events?${query}` : '/runtime/events'
    );
  },
  reportVRMFeedback: (
    payload: {
      conversation_id: string;
      kind: string;
      ok: boolean;
      error?: string;
      state?: Record<string, unknown>;
    }
  ): Promise<ApiResponse<{ ok: boolean }>> =>
    httpClient.post<{ ok: boolean }>('/runtime/vrm-feedback', payload),
};
