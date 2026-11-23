/**
 * Types crossing the NestJS API / Next.js web boundary for the Through Line
 * vertical. The FastAPI analysis engine owns the full result schema; these
 * cover the fields the organization UI renders and the audit trail stores.
 */

export type ThroughlineRunKind = 'ANALYZE' | 'APPROVE' | 'REJECT';

export interface ThroughlineEvidence {
  source_id: string;
  title: string;
  excerpt: string;
  score?: number | null;
}

export interface ThroughlineImpact {
  department: string;
  affected_documents: string[];
  description: string;
  severity: 'High' | 'Medium' | 'Low';
  owner: string;
  evidence: ThroughlineEvidence[];
  recommended_action: string;
  verified: boolean;
}

export interface ThroughlineException {
  title: string;
  customer: string;
  clause: string;
  applies_through: string;
  explanation: string;
  evidence: ThroughlineEvidence[];
}

export interface ThroughlineAction {
  id: string;
  title: string;
  description: string;
  department: string;
  owner: string;
  priority: 'High' | 'Medium' | 'Low';
  evidence: ThroughlineEvidence[];
  status: 'draft' | 'approved' | 'rejected';
  approval_note: string;
}

export interface ThroughlineAnalysis {
  analysis_id: string;
  retrieval_mode: string;
  old_window_days: number | null;
  new_window_days: number | null;
  effective_date: string | null;
  summary: string;
  impacts: ThroughlineImpact[];
  exceptions: ThroughlineException[];
  actions: ThroughlineAction[];
  sources: ThroughlineEvidence[];
  graph: Record<string, unknown>;
  selected_tools: string[];
  execution_log: string[];
  warnings: string[];
}

export interface ThroughlineRun {
  id: string;
  organizationId: string;
  actorId: string;
  kind: ThroughlineRunKind;
  analysisId: string | null;
  summary: string | null;
  createdAt: string;
}
