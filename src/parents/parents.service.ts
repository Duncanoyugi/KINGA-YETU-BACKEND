import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParentProfileDto } from './dto/parent-profile.dto';
import { ParentResponseDto, PaginatedParentsResponseDto } from './dto/parent-response.dto';
import { LinkChildDto } from './dto/link-child.dto';

@Injectable()
export class ParentsService {
  constructor(private prisma: PrismaService) {}

  private mapToParentResponseDto(parent: any): ParentResponseDto {
    return {
      id: parent.id,
      userId: parent.userId,
      fullName: parent.user.fullName,
      email: parent.user.email,
      phoneNumber: parent.user.phoneNumber || undefined,
      emergencyContact: parent.emergencyContact || undefined,
      emergencyPhone: parent.emergencyPhone || undefined,
      children: parent.children?.map(child => ({
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        dateOfBirth: child.dateOfBirth,
        gender: child.gender,
      })) || [],
      childrenCount: parent.children?.length || 0,
      county: parent.user.profile?.county || undefined,
      subCounty: parent.user.profile?.subCounty || undefined,
      address: parent.user.profile?.address || undefined,
      createdAt: parent.createdAt,
      updatedAt: parent.updatedAt,
    };
  }

  async createParentProfile(userId: string, profileData: ParentProfileDto): Promise<ParentResponseDto> {
    // Check if parent profile already exists
    const existingParent = await this.prisma.parent.findUnique({
      where: { userId },
    });

    if (existingParent) {
      throw new ConflictException('Parent profile already exists');
    }

    // Check if user exists and is a parent
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== 'PARENT') {
      throw new BadRequestException('User must have PARENT role to create parent profile');
    }

    // Update user profile if provided
    if (profileData.county || profileData.subCounty || profileData.address) {
      await this.prisma.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          county: profileData.county,
          subCounty: profileData.subCounty,
          address: profileData.address,
        },
        update: {
          ...(profileData.county && { county: profileData.county }),
          ...(profileData.subCounty && { subCounty: profileData.subCounty }),
          ...(profileData.address && { address: profileData.address }),
        },
      });
    }

    // Create parent profile
    const parent = await this.prisma.parent.create({
      data: {
        userId,
        emergencyContact: profileData.emergencyContact,
        emergencyPhone: profileData.emergencyPhone,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        children: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
          },
        },
      },
    });

    return this.mapToParentResponseDto(parent);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    county?: string,
    subCounty?: string,
  ): Promise<PaginatedParentsResponseDto> {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.user = {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    if (county || subCounty) {
      where.user = {
        ...where.user,
        profile: {
          ...(county && { county }),
          ...(subCounty && { subCounty }),
        },
      };
    }

    const [total, parents] = await Promise.all([
      this.prisma.parent.count({ where }),
      this.prisma.parent.findMany({
        skip,
        take: limit,
        where,
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          children: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              dateOfBirth: true,
              gender: true,
            },
            orderBy: { dateOfBirth: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: parents.map(parent => this.mapToParentResponseDto(parent)),
    };
  }

  async findOne(id: string): Promise<ParentResponseDto> {
    const parent = await this.prisma.parent.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        children: {
          include: {
            immunizations: {
              take: 5,
              orderBy: { dateAdministered: 'desc' },
              select: {
                id: true,
                vaccine: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                dateAdministered: true,
                status: true,
              },
            },
            schedules: {
              take: 5,
              where: { status: 'SCHEDULED' },
              orderBy: { dueDate: 'asc' },
              select: {
                id: true,
                vaccine: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                dueDate: true,
                status: true,
              },
            },
          },
          orderBy: { dateOfBirth: 'desc' },
        },
      },
    });

    if (!parent) {
      throw new NotFoundException(`Parent with ID ${id} not found`);
    }

    return this.mapToParentResponseDto(parent);
  }

  async findByUserId(userId: string): Promise<ParentResponseDto> {
    let parent = await this.prisma.parent.findUnique({
      where: { userId },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        children: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
          },
          orderBy: { dateOfBirth: 'desc' },
        },
      },
    });

    // Auto-create parent profile if it doesn't exist (for existing users who registered before the fix)
    if (!parent) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      
      if (user) {
        parent = await this.prisma.parent.create({
          data: {
            userId,
          },
          include: {
            user: {
              include: {
                profile: true,
              },
            },
            children: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                dateOfBirth: true,
                gender: true,
              },
              orderBy: { dateOfBirth: 'desc' },
            },
          },
        });
        console.log(`[ParentsService] Auto-created parent profile for user: ${userId}`);
      }
    }

    if (!parent) {
      throw new NotFoundException('Parent profile not found');
    }

    return this.mapToParentResponseDto(parent);
  }

  async updateParentProfile(userId: string, profileData: ParentProfileDto): Promise<ParentResponseDto> {
    // Check if parent exists
    let parent = await this.prisma.parent.findUnique({
      where: { userId },
    });

    // Auto-create parent profile if it doesn't exist (for existing users who registered before the fix)
    if (!parent) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      
      if (user) {
        parent = await this.prisma.parent.create({
          data: {
            userId,
          },
        });
        console.log(`[ParentsService] Auto-created parent profile for user: ${userId}`);
      }
    }

    if (!parent) {
      throw new NotFoundException('Parent profile not found');
    }

    // Update user profile
    if (profileData.county || profileData.subCounty || profileData.address) {
      await this.prisma.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          county: profileData.county,
          subCounty: profileData.subCounty,
          address: profileData.address,
        },
        update: {
          ...(profileData.county && { county: profileData.county }),
          ...(profileData.subCounty && { subCounty: profileData.subCounty }),
          ...(profileData.address && { address: profileData.address }),
        },
      });
    }

    // Update parent profile
    const updatedParent = await this.prisma.parent.update({
      where: { userId },
      data: {
        emergencyContact: profileData.emergencyContact,
        emergencyPhone: profileData.emergencyPhone,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        children: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
          },
          orderBy: { dateOfBirth: 'desc' },
        },
      },
    });

    return this.mapToParentResponseDto(updatedParent);
  }

  async linkChildToParent(parentId: string, linkChildDto: LinkChildDto): Promise<ParentResponseDto> {
    // Check if parent exists
    const parent = await this.prisma.parent.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      throw new NotFoundException(`Parent with ID ${parentId} not found`);
    }

    // Check if child exists
    const child = await this.prisma.child.findUnique({
      where: { id: linkChildDto.childId },
    });

    if (!child) {
      throw new NotFoundException(`Child with ID ${linkChildDto.childId} not found`);
    }

    // Verify birth certificate if provided
    if (linkChildDto.birthCertificateNo && child.birthCertificateNo !== linkChildDto.birthCertificateNo) {
      throw new BadRequestException('Birth certificate number does not match');
    }

    // Check if child already has a parent
    if (child.parentId && child.parentId !== parentId) {
      throw new ConflictException('Child is already linked to another parent');
    }

    // Link child to parent
    await this.prisma.child.update({
      where: { id: linkChildDto.childId },
      data: {
        parentId,
      },
    });

    // Return updated parent with children
    return this.findOne(parentId);
  }

  async remove(id: string): Promise<void> {
    // Check if parent exists
    const parent = await this.prisma.parent.findUnique({
      where: { id },
      include: {
        children: true,
      },
    });

    if (!parent) {
      throw new NotFoundException(`Parent with ID ${id} not found`);
    }

    // Check if parent has children
    if (parent.children.length > 0) {
      throw new BadRequestException('Cannot delete parent with children. Unlink children first.');
    }

    await this.prisma.parent.delete({
      where: { id },
    });
  }

  async getParentStats() {
    const totalParents = await this.prisma.parent.count();
    
    const parentsByCounty = await this.prisma.$queryRaw`
      SELECT 
        up.county,
        COUNT(*) as count
      FROM parents p
      JOIN users u ON p."userId" = u.id
      LEFT JOIN user_profiles up ON u.id = up."userId"
      WHERE up.county IS NOT NULL
      GROUP BY up.county
      ORDER BY count DESC
    `;

    const parentsByChildrenCount = await this.prisma.$queryRaw`
      SELECT 
        children_count,
        COUNT(*) as parent_count
      FROM (
        SELECT 
          p.id,
          COUNT(c.id) as children_count
        FROM parents p
        LEFT JOIN children c ON p.id = c."parentId"
        GROUP BY p.id
      ) as parent_children
      GROUP BY children_count
      ORDER BY children_count
    `;

    const recentParents = await this.prisma.parent.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            phoneNumber: true,
            profile: {
              select: {
                county: true,
                subCounty: true,
              },
            },
          },
        },
        children: {
          select: {
            id: true,
          },
        },
      },
    });

    return {
      total: totalParents,
      byCounty: parentsByCounty,
      byChildrenCount: parentsByChildrenCount,
      recent: recentParents.map(parent => ({
        id: parent.id,
        fullName: parent.user.fullName,
        email: parent.user.email,
        phone: parent.user.phoneNumber,
        county: parent.user.profile?.county,
        subCounty: parent.user.profile?.subCounty,
        childrenCount: parent.children.length,
        createdAt: parent.createdAt,
      })),
    };
  }

  /**
   * Get parent dashboard data
   */
  async getParentDashboard(parentId: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { id: parentId },
      include: {
        user: true,
        children: {
          include: {
            immunizations: true,
            schedules: {
              where: {
                dueDate: { gte: new Date() },
              },
              orderBy: { dueDate: 'asc' },
              take: 5,
            },
          },
        },
      },
    });

    if (!parent) {
      throw new NotFoundException(`Parent with ID ${parentId} not found`);
    }

    // Get upcoming reminders
    const upcomingReminders = await this.prisma.reminder.findMany({
      where: {
        parentId,
        scheduledFor: { gte: new Date() },
        status: 'PENDING',
      },
      orderBy: { scheduledFor: 'asc' },
      take: 5,
      include: {
        child: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        vaccine: {
          select: {
            name: true,
          },
        },
      },
    });

    // Calculate stats
    const totalChildren = parent.children.length;
    let completedVaccinations = 0;
    let upcomingVaccinations = 0;
    let missedVaccinations = 0;

    for (const child of parent.children) {
      completedVaccinations += child.immunizations.filter(i => i.status === 'ADMINISTERED').length;
      upcomingVaccinations += child.schedules.filter(s => s.status === 'SCHEDULED').length;
      missedVaccinations += child.schedules.filter(s => 
        s.status === 'MISSED' || 
        (s.status === 'SCHEDULED' && new Date(s.dueDate) < new Date())
      ).length;
    }

    const totalVaccinations = completedVaccinations + upcomingVaccinations + missedVaccinations;
    const completionRate = totalVaccinations > 0 
      ? Math.round((completedVaccinations / totalVaccinations) * 100) 
      : 0;

    return {
      parent: {
        id: parent.id,
        fullName: parent.user.fullName,
        email: parent.user.email,
      },
      children: parent.children.map(child => ({
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        dateOfBirth: child.dateOfBirth,
        gender: child.gender,
        completedVaccinations: child.immunizations.filter(i => i.status === 'ADMINISTERED').length,
        upcomingVaccinations: child.schedules.filter(s => s.status === 'SCHEDULED').length,
      })),
      upcomingReminders: upcomingReminders.map(reminder => ({
        id: reminder.id,
        childName: `${reminder.child.firstName} ${reminder.child.lastName}`,
        vaccineName: reminder.vaccine?.name,
        scheduledFor: reminder.scheduledFor,
        status: reminder.status,
      })),
      stats: {
        totalChildren,
        completedVaccinations,
        upcomingVaccinations,
        missedVaccinations,
        completionRate,
      },
    };
  }

  /**
   * Get parent statistics
   */
  async getParentStatsById(parentId: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { id: parentId },
      include: {
        children: {
          include: {
            immunizations: true,
            schedules: true,
          },
        },
      },
    });

    if (!parent) {
      throw new NotFoundException(`Parent with ID ${parentId} not found`);
    }

    const totalChildren = parent.children.length;
    let completedVaccinations = 0;
    let upcomingVaccinations = 0;
    let missedVaccinations = 0;

    for (const child of parent.children) {
      completedVaccinations += child.immunizations.filter(i => i.status === 'ADMINISTERED').length;
      upcomingVaccinations += child.schedules.filter(s => s.status === 'SCHEDULED').length;
      missedVaccinations += child.schedules.filter(s => 
        s.status === 'MISSED' || 
        (s.status === 'SCHEDULED' && new Date(s.dueDate) < new Date())
      ).length;
    }

    const totalVaccinations = completedVaccinations + upcomingVaccinations + missedVaccinations;
    const completionRate = totalVaccinations > 0 
      ? Math.round((completedVaccinations / totalVaccinations) * 100) 
      : 0;

    return {
      totalChildren,
      completedVaccinations,
      upcomingVaccinations,
      missedVaccinations,
      completionRate,
    };
  }

  /**
   * Get children of a parent
   */
  async getParentChildren(parentId: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { id: parentId },
      include: {
        children: {
          include: {
            immunizations: {
              orderBy: { dateAdministered: 'desc' },
              take: 10,
              include: {
                vaccine: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            schedules: {
              orderBy: { dueDate: 'asc' },
              include: {
                vaccine: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!parent) {
      throw new NotFoundException(`Parent with ID ${parentId} not found`);
    }

    return parent.children;
  }

  /**
   * Get reminders for a parent
   */
  async getParentReminders(parentId: string, upcomingOnly: boolean = false) {
    const parent = await this.prisma.parent.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      throw new NotFoundException(`Parent with ID ${parentId} not found`);
    }

    const where: any = {
      parentId,
    };

    if (upcomingOnly) {
      where.scheduledFor = { gte: new Date() };
      where.status = 'PENDING';
    }

    const reminders = await this.prisma.reminder.findMany({
      where,
      orderBy: { scheduledFor: 'asc' },
      include: {
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        vaccine: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return reminders;
  }

  async searchParents(searchTerm: string) {
    const parents = await this.prisma.parent.findMany({
      where: {
        OR: [
          {
            user: {
              fullName: { contains: searchTerm, mode: 'insensitive' },
            },
          },
          {
            user: {
              email: { contains: searchTerm, mode: 'insensitive' },
            },
          },
          {
            user: {
              phoneNumber: { contains: searchTerm, mode: 'insensitive' },
            },
          },
          {
            emergencyContact: { contains: searchTerm, mode: 'insensitive' },
          },
        ],
      },
      take: 20,
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            phoneNumber: true,
            profile: {
              select: {
                county: true,
                subCounty: true,
              },
            },
          },
        },
        children: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return parents.map(parent => ({
      id: parent.id,
      fullName: parent.user.fullName,
      email: parent.user.email,
      phone: parent.user.phoneNumber,
      county: parent.user.profile?.county,
      subCounty: parent.user.profile?.subCounty,
      emergencyContact: parent.emergencyContact,
      emergencyPhone: parent.emergencyPhone,
      childrenCount: parent.children.length,
      children: parent.children.map(child => ({
        id: child.id,
        name: `${child.firstName} ${child.lastName}`,
      })),
    }));
  }
}