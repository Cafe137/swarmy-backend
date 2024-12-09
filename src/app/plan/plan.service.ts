import { BadRequestException, Injectable } from '@nestjs/common';
import { addMonths } from 'date-fns';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { getOnlyPlansRowOrThrow, PlansRow, updatePlansRow } from 'src/DatabaseExtra';

@Injectable()
export class PlanService {
  constructor(
    @InjectPinoLogger(PlanService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getActivePlanForOrganization(organizationId: number): Promise<PlansRow> {
    return getOnlyPlansRowOrThrow({ organizationId, status: 'ACTIVE' });
  }

  async activatePlan(organizationId: number, planId: number): Promise<PlansRow> {
    const existingActivePlan = await this.getActivePlanForOrganization(organizationId);
    if (existingActivePlan) {
      this.logger.error(`Can't activate plan, there is already an active plan for this organization ${organizationId}`);
      throw new BadRequestException('There is already an active plan for this organization', organizationId.toString());
    }

    const now = new Date();
    const paidUntil = addMonths(now, 1);
    await updatePlansRow(planId, { status: 'ACTIVE', paidUntil });
    this.logger.info('Plan activated ', planId);
    return getOnlyPlansRowOrThrow({ id: planId });
  }

  async cancelPlan(organizationId: number, planId: number) {
    const plan = await this.getPlanById(organizationId, planId);
    await updatePlansRow(plan.id, { status: 'CANCELLED' });
  }

  async scheduleActivePlanForCancellation(organizationId: number) {
    const existingActivePlan = await this.getActivePlanForOrganization(organizationId);
    await updatePlansRow(existingActivePlan.id, { cancelAt: existingActivePlan.paidUntil });
  }

  async getPlanById(organizationId: number, planId: number) {
    return getOnlyPlansRowOrThrow({ organizationId, id: planId });
  }
}
