import { Module } from '@nestjs/common';
import { ChildrenService } from './children.service';
import { ChildrenController } from './children.controller';
import { ChildrenRepository } from './children.repository';
import { VaccineSchedulerService } from './vaccine-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ChildrenController],
  providers: [ChildrenService, ChildrenRepository, VaccineSchedulerService],
  exports: [ChildrenService],
})
export class ChildrenModule {}