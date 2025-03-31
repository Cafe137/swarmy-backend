import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  BeesRowId,
  getOnlyOrganizationsRowOrThrow,
  insertOrganizationsRow,
  OrganizationsRow,
  OrganizationsRowId,
} from 'src/database/Schema';
import { StripeService } from '../stripe/stripe.service';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectPinoLogger(OrganizationService.name)
    private readonly logger: PinoLogger,
    private stripeService: StripeService,
  ) {}

  async getOrganization(id: OrganizationsRowId): Promise<OrganizationsRow> {
    return getOnlyOrganizationsRowOrThrow({ id });
  }

  async create(email: string): Promise<OrganizationsRow> {
    const name = `${email}'s organization`;
    const stripeIdentifier = await this.stripeService.createStripeCustomer(email);
    const id = await insertOrganizationsRow({ name, stripeIdentifier, beeId: 1 as BeesRowId });
    this.logger.info('Organization created', name);
    return this.getOrganization(id);
  }
}
