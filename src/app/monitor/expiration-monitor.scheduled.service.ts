import { PostageBatch } from '@ethersphere/bee-js';
import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Dates } from 'cafe-utility';
import { getPlansRows, OrganizationsRow } from 'src/DatabaseExtra';
import { AlertService } from '../alert/alert.service';
import { BeeService } from '../bee/bee.service';
import { OrganizationService } from '../organization/organization.service';

@Injectable()
export class ExpirationMonitorScheduledService {
  constructor(
    private beeService: BeeService,
    private organizationService: OrganizationService,
    private alertService: AlertService,
  ) {}

  @Interval(Dates.minutes(30))
  async checkPostageBatchTTL() {
    const plans = await getPlansRows({ status: 'ACTIVE' });
    const batches = await this.beeService.getAllPostageBatches();
    if (plans.length !== batches.length) {
      this.alertService.sendAlert(
        `Mismatch between the number of active plans (${plans.length}) and the number of batches (${batches.length})`,
      );
    }
    for (const plan of plans) {
      const org = await this.organizationService.getOrganization(plan.organizationId);
      await this.checkTTL(org, batches);
    }
  }

  private async checkTTL(organization: OrganizationsRow, batches: PostageBatch[]) {
    if (!organization.postageBatchId) {
      return;
    }
    const batch = batches.find((batch) => batch.batchID === organization.postageBatchId);
    if (!batch) {
      this.alertService.sendAlert(`Batch ${organization.postageBatchId} not found for organization ${organization.id}`);
      return;
    }
  }
}
