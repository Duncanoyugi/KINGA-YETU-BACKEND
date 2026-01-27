import { ApiProperty } from '@nestjs/swagger';
import { CreateUserDto } from '../../users/dto/create-user.dto';

export class RegisterDto extends CreateUserDto {
  @ApiProperty({
    example: true,
    description: 'Accept terms and conditions',
    default: false,
  })
  acceptTerms: boolean;
}