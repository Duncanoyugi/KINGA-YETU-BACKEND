import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_ACCESS_SECRET');

    if (!secret) {
      // Fail loudly at boot rather than silently signing/verifying with
      // `undefined`, which would make every token trivially forgeable.
      throw new Error(
        'JWT_ACCESS_SECRET is not set. Refusing to start with an undefined JWT secret.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
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
      this.logger.warn(`JWT validation failed for subject ${payload.sub}: user not found or inactive`);
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
