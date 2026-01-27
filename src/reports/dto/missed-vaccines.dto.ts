import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsDateString, IsOptional, IsString, IsNumber, IsArray, IsBoolean } from 'class-validator';

export class MissedVaccinesRequestDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  startDate: Date;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  endDate: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  county?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  subCounty?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  vaccineIds?: string[];

  @ApiProperty({ required: false, default: 30 })
  @IsOptional()
  @IsNumber()
  daysOverdue?: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  includeContactInfo?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  includeFollowUpPlan?: boolean;
}

export class MissedVaccinesResponseDto {
  @ApiProperty()
  reportId: string;

  @ApiProperty()
  period: string;

  @ApiProperty()
  totalMissed: number;

  @ApiProperty()
  totalOverdue: number;

  @ApiProperty()
  percentageOverdue: number;

  @ApiProperty({ type: [Object] })
  byCounty: Array<{
    county: string;
    missed: number;
    overdue: number;
    percentage: number;
  }>;

  @ApiProperty({ type: [Object] })
  byFacility: Array<{
    facilityName: string;
    missed: number;
    overdue: number;
    percentage: number;
  }>;

  @ApiProperty({ type: [Object] })
  byVaccine: Array<{
    vaccineName: string;
    missed: number;
    overdue: number;
    recommendedAge: number;
  }>;

  @ApiProperty({ type: [Object], required: false })
  childrenList?: Array<{
    childName: string;
    age: number;
    missedVaccines: string[];
    daysOverdue: number;
    parentPhone?: string;
    lastContactDate?: Date;
  }>;

  @ApiProperty({ required: false })
  followUpPlan?: {
    immediateAction: number;
    within7Days: number;
    within30Days: number;
    totalRequired: number;
  };

  @ApiProperty()
  generatedAt: Date;

  @ApiProperty()
  downloadUrl: string;
}