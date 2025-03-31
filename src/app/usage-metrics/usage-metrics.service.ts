import { BadRequestException, Injectable } from '@nestjs/common';
import { Dates } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  getOnlyUsageMetricsRowOrThrow,
  getUsageMetricsRows,
  insertUsageMetricsRow,
  OrganizationsRowId,
  updateUsageMetricsRow,
  UsageMetricsRow,
} from 'src/database/Schema';
import { UsageMetricType } from './usage-metric-type';

@Injectable()
export class UsageMetricsService {
  constructor(
    @InjectPinoLogger(UsageMetricsService.name)
    private readonly logger: PinoLogger,
  ) {}

  async incrementOrFail(organizationId: OrganizationsRowId, type: 'up' | 'down', value: number) {
    value = this.roundUp(value, 8192);
    const metric = await this.getForOrganization(organizationId, type === 'up' ? 'UPLOADED_BYTES' : 'DOWNLOADED_BYTES');
    const newValue = metric.used + value;
    if (newValue > metric.available) {
      throw new BadRequestException(
        `Not enough quota for ${type}load. Used: ${metric.used}, available: ${metric.available}`,
      );
    }
    this.logger.debug(`Incrementing metric ${metric.id} to used ${newValue}`);
    await updateUsageMetricsRow(metric.id, { used: metric.used + value });
  }

  async getAllForOrganization(organizationId: OrganizationsRowId): Promise<UsageMetricsRow[]> {
    return getUsageMetricsRows({ organizationId });
  }

  async upgradeCurrentMetrics(organizationId: OrganizationsRowId, uploadSizeLimit: number, downloadSizeLimit: number) {
    const uploadMetric = await getOnlyUsageMetricsRowOrThrow({ organizationId, type: 'UPLOADED_BYTES' });
    const downloadMetric = await getOnlyUsageMetricsRowOrThrow({ organizationId, type: 'DOWNLOADED_BYTES' });
    await updateUsageMetricsRow(uploadMetric.id, { available: uploadSizeLimit });
    await updateUsageMetricsRow(downloadMetric.id, { available: downloadSizeLimit });
  }

  async createInitialMetrics(organizationId: OrganizationsRowId) {
    await insertUsageMetricsRow({
      organizationId,
      available: 0,
      type: 'UPLOADED_BYTES',
      periodEndsAt: new Date(Date.now() + Dates.days(30)),
    });
    await insertUsageMetricsRow({
      organizationId,
      available: 0,
      type: 'DOWNLOADED_BYTES',
      periodEndsAt: new Date(Date.now() + Dates.days(30)),
    });
  }

  async resetForOrganization(organizationId: OrganizationsRowId) {
    const metrics = await this.getAllForOrganization(organizationId);
    for (const metric of metrics) {
      await updateUsageMetricsRow(metric.id, { used: 0, periodEndsAt: new Date(Date.now() + Dates.days(30)) });
    }
  }

  private async getForOrganization(
    organizationId: OrganizationsRowId,
    type: UsageMetricType,
  ): Promise<UsageMetricsRow> {
    return getOnlyUsageMetricsRowOrThrow({ organizationId, type });
  }

  private roundUp(numToRound: number, multiple: number) {
    if (multiple === 0) {
      return numToRound;
    }

    const remainder = numToRound % multiple;
    if (remainder === 0) {
      return numToRound;
    }

    return numToRound + multiple - remainder;
  }
}
