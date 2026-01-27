import { Module } from '@nestjs/common';
import { ImmunizationsService } from './immunizations.service';
import { ImmunizationsController } from './immunizations.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { VaccinesModule } from '../vaccines/vaccines.module';
import { ChildrenModule } from '../children/children.module';

@Module({
  imports: [PrismaModule, VaccinesModule, ChildrenModule],
  controllers: [ImmunizationsController],
  providers: [ImmunizationsService],
  exports: [ImmunizationsService],
})
export class ImmunizationsModule {}