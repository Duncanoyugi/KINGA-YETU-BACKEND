import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export enum NotificationType {
  VACCINE_REMINDER = 'VACCINE_REMINDER',
  APPOINTMENT_CONFIRMATION = 'APPOINTMENT_CONFIRMATION',
  REPORT_READY = 'REPORT_READY',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  SECURITY_ALERT = 'SECURITY_ALERT'
}

export class CreateNotificationDto {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  data?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  userId: string;
}
