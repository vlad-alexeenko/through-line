import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TokenPayload } from '@app-starter/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { ThroughlineService } from './throughline.service';
import { AnalyzeThroughlineDto } from './dto/analyze-throughline.dto';
import { ThroughlineDecisionDto } from './dto/throughline-decision.dto';

/**
 * Organization-scoped Through Line routes.
 *
 * The organization id sits in the path so tenant scoping is visible at the
 * route level. Membership and role checks happen in the service layer, where
 * the JWT subject is resolved against the route's organization id — a client
 * supplied organizationId alone never authenticates anyone.
 */
@ApiTags('throughline')
@Controller('organizations/:organizationId/throughline')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class ThroughlineController {
  constructor(private readonly throughlineService: ThroughlineService) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run a policy impact analysis for an organization' })
  @ApiResponse({ status: 200, description: 'Analysis with impacts, exceptions, and action drafts' })
  async analyze(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Body() data: AnalyzeThroughlineDto,
  ): Promise<unknown> {
    return this.throughlineService.analyze(req.user.sub, organizationId, data);
  }

  @Post('actions/:actionId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a Through Line action (OWNER or ADMIN)' })
  async approve(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Param('actionId') actionId: string,
    @Body() data: ThroughlineDecisionDto,
  ): Promise<unknown> {
    return this.throughlineService.approve(req.user.sub, organizationId, actionId, data);
  }

  @Post('actions/:actionId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a Through Line action (OWNER or ADMIN)' })
  async reject(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Param('actionId') actionId: string,
    @Body() data: ThroughlineDecisionDto,
  ): Promise<unknown> {
    return this.throughlineService.reject(req.user.sub, organizationId, actionId, data);
  }

  @Get('runs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List this organization’s Through Line audit trail' })
  async listRuns(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
  ): Promise<unknown> {
    return this.throughlineService.listRuns(req.user.sub, organizationId);
  }
}
