import { Module } from '@nestjs/common';
import { AlertModule } from '../alert/alert.module';
import { PaymentNotificationService } from './payment-notification.service';
import { PaymentService } from './payment.service';

@Module({
  controllers: [],
  providers: [PaymentService, PaymentNotificationService],
  exports: [PaymentService, PaymentNotificationService],
  imports: [AlertModule],
})
export class PaymentModule {}
