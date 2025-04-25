import { Module } from '@nestjs/common';
import { AlertService } from '../alert/alert.service';
import { PaymentNotificationService } from './payment-notification.service';
import { PaymentService } from './payment.service';

@Module({
  controllers: [],
  providers: [PaymentService, PaymentNotificationService],
  exports: [PaymentService, PaymentNotificationService],
  imports: [AlertService],
})
export class PaymentModule {}
