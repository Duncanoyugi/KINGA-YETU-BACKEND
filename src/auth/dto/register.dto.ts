import { ApiProperty } from '@nestjs/swagger';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class RegisterDto extends CreateUserDto {
  @ApiProperty({
    example: true,
    description: 'Accept terms and conditions',
    default: false,
  })
  @IsBoolean()
  @IsNotEmpty()
  acceptTerms: boolean;
}
