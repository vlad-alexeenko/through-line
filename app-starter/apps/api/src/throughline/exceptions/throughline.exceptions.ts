import { ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

export class ThroughlineOrgNotFoundException extends NotFoundException {
  constructor(organizationId: string) {
    // A valid id from another tenant reads as "not found" rather than
    // confirming that the organization exists.
    super(`Organization not found: ${organizationId}`);
  }
}

export class ThroughlineAccessDeniedException extends ForbiddenException {
  constructor(action: string) {
    super(`You do not have permission to ${action} Through Line analyses`);
  }
}

export class ThroughlineEngineException extends ServiceUnavailableException {
  constructor() {
    super('Analysis engine is unavailable');
  }
}
