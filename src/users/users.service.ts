import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserResponseDto, PaginatedUsersResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService,
  ) {}

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  private mapToUserResponseDto(user: any): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber || undefined,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      lastLoginAt: user.lastLoginAt || undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile: user.profile
        ? {
            dateOfBirth: user.profile.dateOfBirth || undefined,
            gender: user.profile.gender || undefined,
            profilePicture: user.profile.profilePicture || undefined,
            address: user.profile.address || undefined,
            county: user.profile.county || undefined,
            subCounty: user.profile.subCounty || undefined,
            ward: user.profile.ward || undefined,
            idNumber: user.profile.idNumber || undefined,
          }
        : undefined,
      parentProfile: user.parentProfile
        ? {
            emergencyContact: user.parentProfile.emergencyContact || undefined,
            emergencyPhone: user.parentProfile.emergencyPhone || undefined,
          }
        : undefined,
      healthWorker: user.healthWorker
        ? {
            licenseNumber: user.healthWorker.licenseNumber || undefined,
            qualification: user.healthWorker.qualification || undefined,
            specialization: user.healthWorker.specialization || undefined,
            facility: user.healthWorker.facility
              ? {
                  id: user.healthWorker.facility.id,
                  name: user.healthWorker.facility.name,
                  code: user.healthWorker.facility.code,
                }
              : undefined,
          }
        : undefined,
      adminProfile: user.adminProfile
        ? {
            department: user.adminProfile.department || undefined,
            permissions: user.adminProfile.permissions,
          }
        : undefined,
    };
  }

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // Check if email already exists
    const existingEmail = await this.usersRepository.findByEmail(createUserDto.email);
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    // Check if phone number already exists
    if (createUserDto.phoneNumber) {
      const existingPhone = await this.usersRepository.findByPhone(createUserDto.phoneNumber);
      if (existingPhone) {
        throw new ConflictException('Phone number already exists');
      }
    }

    // Hash password
    const hashedPassword = await this.hashPassword(createUserDto.password);

    // Create user
    const user = await this.usersRepository.create(createUserDto, hashedPassword);

    // If user is registering as PARENT, automatically create parent profile
    if (user.role === 'PARENT') {
      await this.prisma.parent.create({
        data: {
          userId: user.id,
        },
      });
      console.log(`✅ [UsersService] Parent profile created for user: ${user.email}`);
    }

    return this.mapToUserResponseDto(user);
  }

  async findAll(query: QueryUsersDto): Promise<PaginatedUsersResponseDto> {
    const result = await this.usersRepository.findAll(query);
    
    return {
      total: result.total,
      page: Number(result.page),
      limit: Number(result.limit),
      totalPages: result.totalPages,
      data: result.data.map(user => this.mapToUserResponseDto(user)),
    };
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return this.mapToUserResponseDto(user);
  }

  async findByEmail(email: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }
    return this.mapToUserResponseDto(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    // Check if user exists
    const existingUser = await this.usersRepository.findOne(id);
    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Check if email is being changed and if it already exists
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailExists = await this.usersRepository.findByEmail(updateUserDto.email);
      if (emailExists) {
        throw new ConflictException('Email already exists');
      }
    }

    // Check if phone number is being changed and if it already exists
    if (updateUserDto.phoneNumber && updateUserDto.phoneNumber !== existingUser.phoneNumber) {
      const phoneExists = await this.usersRepository.findByPhone(updateUserDto.phoneNumber);
      if (phoneExists) {
        throw new ConflictException('Phone number already exists');
      }
    }

    const updatedUser = await this.usersRepository.update(id, updateUserDto);
    return this.mapToUserResponseDto(updatedUser);
  }

  async changePassword(id: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    // Check if user exists
    const user = await this.usersRepository.findOne(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Check if new password matches confirmation
    if (changePasswordDto.newPassword !== changePasswordDto.confirmNewPassword) {
      throw new BadRequestException('New password and confirmation do not match');
    }

    // Check if new password is same as old password
    const isSamePassword = await bcrypt.compare(
      changePasswordDto.newPassword,
      user.password,
    );
    if (isSamePassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    // Hash new password
    const hashedPassword = await this.hashPassword(changePasswordDto.newPassword);

    // Update password
    await this.usersRepository.updatePassword(id, hashedPassword);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.usersRepository.updateLastLogin(id);
  }

  async remove(id: string): Promise<void> {
    // Check if user exists
    const user = await this.usersRepository.findOne(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Prevent deletion of super admin
    if (user.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot delete super admin user');
    }

    await this.usersRepository.remove(id);
  }

  async deactivate(id: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (user.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot deactivate super admin user');
    }

    const updatedUser = await this.usersRepository.update(id, { isActive: false });
    return this.mapToUserResponseDto(updatedUser);
  }

  async activate(id: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const updatedUser = await this.usersRepository.update(id, { isActive: true });
    return this.mapToUserResponseDto(updatedUser);
  }

  async getStats() {
    return this.usersRepository.getStats();
  }

  async verifyUser(id: string, type: 'email' | 'phone'): Promise<UserResponseDto> {
    const updateData: UpdateUserDto = {};
    if (type === 'email') {
      updateData.isEmailVerified = true;
    } else if (type === 'phone') {
      updateData.isPhoneVerified = true;
    }

    const updatedUser = await this.usersRepository.update(id, updateData);
    return this.mapToUserResponseDto(updatedUser);
  }

  async updateRole(id: string, role: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Prevent changing super admin role
    if (user.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot change role of super admin user');
    }

    const updatedUser = await this.usersRepository.update(id, { role: role as any });
    return this.mapToUserResponseDto(updatedUser);
  }
}