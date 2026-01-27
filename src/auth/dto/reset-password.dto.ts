import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'User email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordConfirmDto {
  @ApiProperty({
    example: '123456',
    description: 'OTP code',
  })
  @IsString()
  @IsNotEmpty()
  otpCode: string;

  @ApiProperty({
    example: 'NewPassword@123',
    description: 'New password (min 8 characters)',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character',
  })
  newPassword: string;

  @ApiProperty({
    example: 'NewPassword@123',
    description: 'Confirm new password',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  confirmNewPassword: string;
}