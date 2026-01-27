import { Module } from '@nestjs/common';
import { VaccinesService } from './vaccines.service';
import { VaccinesController } from './vaccines.controller';
import { KenyaScheduleService } from './keni-schedule.service';
import { VaccinesSeed } from './seeds/vaccines.seed';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VaccinesController],
  providers: [VaccinesService, KenyaScheduleService, VaccinesSeed],
  exports: [VaccinesService, KenyaScheduleService],
})
export class VaccinesModule {}