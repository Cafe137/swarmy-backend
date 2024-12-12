import { Module } from '@nestjs/common';
import { StripeModule } from '../stripe/stripe.module';
import { OrganizationService } from './organization.service';

@Module({
  controllers: [],
  providers: [OrganizationService],
  exports: [OrganizationService],
  imports: [StripeModule],
})
export class OrganizationModule {}
