import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class LinkChildDto {
  @ApiProperty({
    example: 'clm89djs300s0p29jf9s',
    description: 'Child ID',
  })
  @IsString()
  @IsNotEmpty()
  childId: string;

  @ApiProperty({
    example: 'KC12345678',
    description: 'Birth certificate number for verification',
    required: false,
  })
  @IsOptional()
  @IsString()
  birthCertificateNo?: string;
}