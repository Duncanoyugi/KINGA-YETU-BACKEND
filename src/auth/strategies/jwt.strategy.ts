import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        profile: true,
        parentProfile: true,
        healthWorker: {
          include: {
            facility: true,
          },
        },
        adminProfile: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or account is inactive');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      profile: user.profile,
      parentProfile: user.parentProfile,
      healthWorker: user.healthWorker,
      adminProfile: user.adminProfile,
      isEmailVerified: user.isEmailVerified,
    };
  }
}