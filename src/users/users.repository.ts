import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User, UserRole } from '@prisma/client';
import { QueryUsersDto } from './dto/query-users.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersRepository {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto, hashedPassword: string): Promise<User> {
    const {
      dateOfBirth,
      gender,
      county,
      subCounty,
      address,
      idNumber,
      emergencyContact,
      emergencyPhone,
      licenseNumber,
      qualification,
      specialization,
      facilityId,
      department,
      permissions,
      ...userData
    } = createUserDto;

    const data: Prisma.UserCreateInput = {
      ...userData,
      password: hashedPassword,
    };

    // Add profile if any profile fields provided
    if (dateOfBirth || gender || county || subCounty || address || idNumber) {
      data.profile = {
        create: {
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          gender,
          county,
          subCounty,
          address,
          idNumber,
        },
      };
    }

    // Add role-specific data
    switch (userData.role) {
      case UserRole.PARENT:
        if (emergencyContact || emergencyPhone) {
          data.parentProfile = {
            create: {
              emergencyContact,
              emergencyPhone,
            },
          };
        }
        break;

      case UserRole.HEALTH_WORKER:
        if (licenseNumber || qualification || specialization || facilityId) {
          data.healthWorker = {
            create: {
              licenseNumber,
              qualification,
              specialization,
              ...(facilityId && {
                facility: {
                  connect: { id: facilityId },
                },
              }),
            },
          };
        }
        break;

      case UserRole.ADMIN:
      case UserRole.SUPER_ADMIN:
        if (department || permissions) {
          data.adminProfile = {
            create: {
              department,
              permissions: permissions || '[]',
            },
          };
        }
        break;
    }

    return this.prisma.user.create({
      data,
      include: {
        profile: true,
        parentProfile: true,
        healthWorker: {
          include: {
            facility: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        adminProfile: true,
      },
    });
  }

  async findAll(query: QueryUsersDto) {
    const {
      role,
      county,
      subCounty,
      search,
      isActive,
      isEmailVerified,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;
    const take = limit;

    // Build where clause
    const where: Prisma.UserWhereInput = {};

    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;
    if (isEmailVerified !== undefined) where.isEmailVerified = isEmailVerified;

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Search filter (name, email, phone)
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Profile filters
    if (county || subCounty) {
      where.profile = {};
      if (county) where.profile.county = county;
      if (subCounty) where.profile.subCounty = subCounty;
    }

    // Get total count
    const total = await this.prisma.user.count({ where });

    // Fix for computed property name - use proper Prisma syntax
    const orderBy: Prisma.UserOrderByWithRelationInput = {};
    if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder;
    } else if (sortBy === 'fullName') {
      orderBy.fullName = sortOrder;
    } else if (sortBy === 'email') {
      orderBy.email = sortOrder;
    } else if (sortBy === 'role') {
      orderBy.role = sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    // Get paginated data
    const users = await this.prisma.user.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        profile: true,
        parentProfile: true,
        healthWorker: {
          include: {
            facility: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        adminProfile: true,
      },
    });

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: users,
    };
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        parentProfile: true,
        healthWorker: {
          include: {
            facility: {
              select: {
                id: true,
                name: true,
                code: true,
                mflCode: true,
                type: true,
                county: true,
                subCounty: true,
              },
            },
          },
        },
        adminProfile: true,
        // Remove children since it doesn't exist in User model
        // Use parentProfile.children instead if needed
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
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
  }

  async findByPhone(phoneNumber: string) {
    return this.prisma.user.findUnique({
      where: { phoneNumber },
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
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const {
      dateOfBirth,
      gender,
      county,
      subCounty,
      address,
      idNumber,
      emergencyContact,
      emergencyPhone,
      licenseNumber,
      qualification,
      specialization,
      facilityId,
      department,
      permissions,
      ...userData
    } = updateUserDto;

    const data: Prisma.UserUpdateInput = { ...userData };

    // Update profile if provided
    if (dateOfBirth || gender || county || subCounty || address || idNumber) {
      data.profile = {
        upsert: {
          create: {
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
            gender,
            county,
            subCounty,
            address,
            idNumber,
          },
          update: {
            ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
            ...(gender && { gender }),
            ...(county && { county }),
            ...(subCounty && { subCounty }),
            ...(address && { address }),
            ...(idNumber && { idNumber }),
          },
        },
      };
    }

    // Update role-specific data
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { parentProfile: true, healthWorker: true, adminProfile: true },
    });

    if (user?.role === UserRole.PARENT && (emergencyContact || emergencyPhone)) {
      data.parentProfile = {
        upsert: {
          create: { emergencyContact, emergencyPhone },
          update: { emergencyContact, emergencyPhone },
        },
      };
    }

    if (user?.role === UserRole.HEALTH_WORKER && (licenseNumber || qualification || specialization || facilityId)) {
      data.healthWorker = {
        upsert: {
          create: {
            licenseNumber,
            qualification,
            specialization,
            ...(facilityId && {
              facility: { connect: { id: facilityId } },
            }),
          },
          update: {
            ...(licenseNumber && { licenseNumber }),
            ...(qualification && { qualification }),
            ...(specialization && { specialization }),
            ...(facilityId && {
              facility: { connect: { id: facilityId } },
            }),
          },
        },
      };
    }

    if ((user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN) && (department || permissions)) {
      data.adminProfile = {
        upsert: {
          create: { department, permissions: permissions || '[]' },
          update: { department, permissions: permissions || '[]' },
        },
      };
    }

    return this.prisma.user.update({
      where: { id },
      data,
      include: {
        profile: true,
        parentProfile: true,
        healthWorker: {
          include: {
            facility: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        adminProfile: true,
      },
    });
  }

  async updatePassword(id: string, hashedPassword: string) {
    return this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  async updateLastLogin(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async count(where?: Prisma.UserWhereInput): Promise<number> {
    return this.prisma.user.count({ where });
  }

  async getStats() {
    const totalUsers = await this.prisma.user.count();
    const usersByRole = await this.prisma.user.groupBy({
      by: ['role'],
      _count: true,
    });

    const recentUsers = await this.prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    const usersByDate = await this.prisma.$queryRaw`
      SELECT 
        DATE("createdAt") as date,
        COUNT(*) as count
      FROM "users"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    return {
      total: totalUsers,
      byRole: usersByRole.reduce((acc: Record<string, number>, item) => {
        acc[item.role] = item._count;
        return acc;
      }, {}),
      recent: recentUsers,
      growth: usersByDate,
    };
  }
}