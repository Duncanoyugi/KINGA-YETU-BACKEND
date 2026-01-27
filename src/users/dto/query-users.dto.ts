import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsNumber, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryUsersDto {
  @ApiProperty({
    enum: UserRole,
    example: UserRole.PARENT,
    description: 'Filter by user role',
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({
    example: 'Nairobi',
    description: 'Filter by county',
    required: false,
  })
  @IsOptional()
  @IsString()
  county?: string;

  @ApiProperty({
    example: 'Westlands',
    description: 'Filter by sub-county',
    required: false,
  })
  @IsOptional()
  @IsString()
  subCounty?: string;

  @ApiProperty({
    example: 'John',
    description: 'Search by name or email',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    example: true,
    description: 'Filter by active status',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiProperty({
    example: true,
    description: 'Filter by email verification status',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isEmailVerified?: boolean;

  @ApiProperty({
    example: '2024-01-01',
    description: 'Filter users created after this date',
    required: false,
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({
    example: '2024-12-31',
    description: 'Filter users created before this date',
    required: false,
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({
    example: 1,
    description: 'Page number',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    example: 10,
    description: 'Number of items per page',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({
    example: 'createdAt',
    description: 'Field to sort by',
    required: false,
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiProperty({
    example: 'desc',
    description: 'Sort direction (asc or desc)',
    required: false,
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}