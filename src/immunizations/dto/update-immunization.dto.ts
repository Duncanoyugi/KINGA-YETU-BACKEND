import { ApiProperty, PartialType } from '@nestjs/swagger';
import { RecordImmunizationDto } from './record-immunization.dto';
import { IsOptional, IsString, IsDateString, IsEnum, IsBoolean } from 'class-validator';
import { ImmunizationStatus } from '@prisma/client';

export class UpdateImmunizationDto extends PartialType(RecordImmunizationDto) {
  @ApiProperty({
    enum: ImmunizationStatus,
    example: ImmunizationStatus.ADMINISTERED,
    description: 'Updated immunization status',
    required: false,
  })
  @IsOptional()
  @IsEnum(ImmunizationStatus)
  status?: ImmunizationStatus;

  @ApiProperty({
    example: 'Updated batch number',
    description: 'Updated batch/lot number',
    required: false,
  })
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiProperty({
    example: 'Updated notes',
    description: 'Updated notes/observations',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    example: true,
    description: 'Updated adverse reaction status',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  hadAdverseReaction?: boolean;

  @ApiProperty({
    example: 'Severe fever',
    description: 'Updated adverse reaction details',
    required: false,
  })
  @IsOptional()
  @IsString()
  adverseReactionDetails?: string;
}