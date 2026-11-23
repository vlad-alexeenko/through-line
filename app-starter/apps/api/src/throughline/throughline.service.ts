import { Injectable } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { AnalyzeThroughlineDto } from './dto/analyze-throughline.dto';
import { ThroughlineDecisionDto } from './dto/throughline-decision.dto';
import {
  ThroughlineAccessDeniedException,
  ThroughlineEngineException,
  ThroughlineOrgNotFoundException,
} from './exceptions/throughline.exceptions';

/**
 * Organization-scoped gateway to the Through Line analysis engine.
 *
 * Authentication (JWT) and membership are verified here, in the service
 * layer, following the Projects reference shape: the organization id comes
 * from the route, the caller's role is resolved server-side, and a foreign
 * organization id reads as 404. The heavy analysis (HydraDB retrieval,
 * impact detection, approvals) stays in the existing FastAPI engine, which
 * this service calls server-to-server with an internal token.
 *
 * Demo scope note: the engine's HydraDB/SQLite stores are shared across
 * organizations; this module gates *access* per organization and records a
 * per-organization audit trail, but does not claim per-tenant data
 * isolation in the engine itself.
 */
@Injectable()
export class ThroughlineService {
  private static readonly ANALYZE_ROLES: OrgRole[] = [OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER];

  private static readonly DECIDE_ROLES: OrgRole[] = [OrgRole.OWNER, OrgRole.ADMIN];

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
    private readonly configService: ConfigService,
  ) {}

  private engineBaseUrl(): string {
    return this.configService.get<string>('THROUGHLINE_ENGINE_URL', 'http://localhost:8000');
  }

  private async engineFetch(path: string, init: RequestInit): Promise<unknown> {
    const internalToken = this.configService.get<string>('THROUGHLINE_INTERNAL_TOKEN', '');
    let response: Response;
    try {
      response = await fetch(`${this.engineBaseUrl()}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(internalToken ? { 'X-Internal-Token': internalToken } : {}),
          ...(init.headers ?? {}),
        },
      });
    } catch {
      throw new ThroughlineEngineException();
    }
    if (!response.ok) {
      throw new ThroughlineEngineException();
    }
    return response.json() as Promise<unknown>;
  }

  private async requireMembership(userId: string, organizationId: string): Promise<OrgRole> {
    const role = await this.organizationsService.getUserRoleInOrganization(userId, organizationId);
    if (!role) {
      throw new ThroughlineOrgNotFoundException(organizationId);
    }
    return role;
  }

  private async requireRole(
    userId: string,
    organizationId: string,
    allowed: OrgRole[],
    action: string,
  ): Promise<OrgRole> {
    const role = await this.requireMembership(userId, organizationId);
    if (!allowed.includes(role)) {
      throw new ThroughlineAccessDeniedException(action);
    }
    return role;
  }

  async analyze(
    userId: string,
    organizationId: string,
    data: AnalyzeThroughlineDto,
  ): Promise<unknown> {
    await this.requireRole(userId, organizationId, ThroughlineService.ANALYZE_ROLES, 'run');
    const result = (await this.engineFetch('/api/changes/analyze', {
      method: 'POST',
      body: JSON.stringify({ change_request: data.changeRequest }),
    })) as { analysis_id?: string; summary?: string };
    await this.prisma.throughlineRun.create({
      data: {
        organizationId,
        actorId: userId,
        kind: 'ANALYZE',
        analysisId: result.analysis_id ?? null,
        summary: result.summary?.slice(0, 500) ?? null,
      },
    });
    return result;
  }

  async approve(
    userId: string,
    organizationId: string,
    actionId: string,
    data: ThroughlineDecisionDto,
  ): Promise<unknown> {
    await this.requireRole(userId, organizationId, ThroughlineService.DECIDE_ROLES, 'approve');
    const result = await this.engineFetch(`/api/actions/${actionId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note: data.note ?? '' }),
    });
    await this.prisma.throughlineRun.create({
      data: {
        organizationId,
        actorId: userId,
        kind: 'APPROVE',
        analysisId: null,
        summary: `Approved action ${actionId}`,
      },
    });
    return result;
  }

  async reject(
    userId: string,
    organizationId: string,
    actionId: string,
    data: ThroughlineDecisionDto,
  ): Promise<unknown> {
    await this.requireRole(userId, organizationId, ThroughlineService.DECIDE_ROLES, 'reject');
    const result = await this.engineFetch(`/api/actions/${actionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note: data.note ?? '' }),
    });
    await this.prisma.throughlineRun.create({
      data: {
        organizationId,
        actorId: userId,
        kind: 'REJECT',
        analysisId: null,
        summary: `Rejected action ${actionId}`,
      },
    });
    return result;
  }

  async listRuns(userId: string, organizationId: string): Promise<unknown> {
    await this.requireMembership(userId, organizationId);
    const runs = await this.prisma.throughlineRun.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      items: runs.map((run) => ({
        ...run,
        createdAt: run.createdAt.toISOString(),
      })),
      total: runs.length,
    };
  }
}
