import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { OrganizationModule } from '../organization/organization.module';
import { UsageMetricsModule } from '../usage-metrics/usage-metrics.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [OrganizationModule, EmailModule, UsageMetricsModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
