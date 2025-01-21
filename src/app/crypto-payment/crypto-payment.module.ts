import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { CryptoPaymentController } from './crypto-payment.controller';
import { CryptoPaymentScheduledService } from './crypto-payment.scheduled.service';
import { CryptoPaymentService } from './crypto-payment.service';

@Module({
  imports: [EmailModule],
  controllers: [CryptoPaymentController],
  providers: [CryptoPaymentService, CryptoPaymentScheduledService],
  exports: [],
})
export class CryptoPaymentModule {}
