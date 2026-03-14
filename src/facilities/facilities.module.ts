import { Module } from '@nestjs/common';
import { FacilitiesService } from './facilities.service';
import { FacilitiesController } from './facilities.controller';
import { FacilitiesRepository } from './facilities.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FacilitiesController],
  providers: [FacilitiesService, FacilitiesRepository],
  exports: [FacilitiesService, FacilitiesRepository],
})
export class FacilitiesModule {}
