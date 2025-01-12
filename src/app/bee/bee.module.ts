import { Module } from '@nestjs/common';
import { BeeService } from './bee.service';
import { BeeHiveService } from './bee-hive.service';

@Module({
  controllers: [],
  providers: [BeeService, BeeHiveService],
  exports: [BeeService, BeeHiveService],
})
export class BeeModule {}
