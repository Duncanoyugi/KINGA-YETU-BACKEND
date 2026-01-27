import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateOtpDto {
  @ApiProperty({
    example: true,
    description: 'Mark OTP as used',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isUsed?: boolean;
}