import { apiClient } from './api-client';
import type {
  ThroughlineAction,
  ThroughlineAnalysis,
  ThroughlineRun,
} from '@app-starter/shared';

export interface AnalyzeThroughlineRequest {
  changeRequest: string;
}

export interface ThroughlineDecisionRequest {
  note?: string;
}

export interface ThroughlineRunListResponse {
  items: ThroughlineRun[];
  total: number;
}

export class ThroughlineApi {
  async analyze(organizationId: string, data: AnalyzeThroughlineRequest): Promise<ThroughlineAnalysis> {
    return apiClient.post<ThroughlineAnalysis>(
      `/api/organizations/${organizationId}/throughline/analyze`,
      data,
    );
  }

  async approve(
    organizationId: string,
    actionId: string,
    data: ThroughlineDecisionRequest,
  ): Promise<ThroughlineAction> {
    return apiClient.post<ThroughlineAction>(
      `/api/organizations/${organizationId}/throughline/actions/${actionId}/approve`,
      data,
    );
  }

  async reject(
    organizationId: string,
    actionId: string,
    data: ThroughlineDecisionRequest,
  ): Promise<ThroughlineAction> {
    return apiClient.post<ThroughlineAction>(
      `/api/organizations/${organizationId}/throughline/actions/${actionId}/reject`,
      data,
    );
  }

  async listRuns(organizationId: string): Promise<ThroughlineRunListResponse> {
    return apiClient.get<ThroughlineRunListResponse>(
      `/api/organizations/${organizationId}/throughline/runs`,
    );
  }
}

export const throughlineApi = new ThroughlineApi();
