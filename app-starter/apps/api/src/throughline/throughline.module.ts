import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ThroughlineController } from './throughline.controller';
import { ThroughlineService } from './throughline.service';

@Module({
  imports: [PrismaModule, OrganizationsModule],
  controllers: [ThroughlineController],
  providers: [ThroughlineService],
  exports: [ThroughlineService],
})
export class ThroughlineModule {}
