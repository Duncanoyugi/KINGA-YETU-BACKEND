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
    const secret = configService.get<string>('JWT_ACCESS_SECRET');
    console.log('='.repeat(60));
    console.log('[JwtStrategy] CONSTRUCTOR - JWT_ACCESS_SECRET:', secret ? `✓ FOUND: ${secret.substring(0, 10)}...` : '✗ NOT FOUND!');
    console.log('[JwtStrategy] ALL JWT CONFIG:');
    console.log('  - JWT_ACCESS_SECRET:', configService.get('JWT_ACCESS_SECRET') ? 'SET' : 'NOT SET');
    console.log('  - JWT_ACCESS_EXPIRY:', configService.get('JWT_ACCESS_EXPIRY') || 'default (15m)');
    console.log('='.repeat(60));
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    console.log('[JwtStrategy] ========== VALIDATE CALLED ==========');
    console.log('[JwtStrategy] Payload received:', JSON.stringify(payload));
    console.log('[JwtStrategy] User ID (sub):', payload.sub);
    
    try {
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

      console.log('[JwtStrategy] User found in DB:', user ? user.email : 'NULL');
      console.log('[JwtStrategy] User isActive:', user?.isActive);

      if (!user) {
        console.log('[JwtStrategy] ERROR: User not found for ID:', payload.sub);
        throw new UnauthorizedException('User not found or account is inactive');
      }
      
      if (!user.isActive) {
        console.log('[JwtStrategy] ERROR: User account is inactive:', user.email);
        throw new UnauthorizedException('User not found or account is inactive');
      }

      console.log('[JwtStrategy] SUCCESS - User validated:', user.email);
      
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
    } catch (error) {
      console.log('[JwtStrategy] ERROR in validate():', error.message);
      throw error;
    }
  }
}