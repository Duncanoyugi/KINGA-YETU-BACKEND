import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Child, Gender } from '@prisma/client';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';

@Injectable()
export class ChildrenRepository {
  constructor(private prisma: PrismaService) {}

async create(createChildDto: CreateChildDto & { parentId: string }): Promise<Child> {
    const {
      parentId,
      birthFacilityId,
      birthWeight,
      birthHeight,
      deliveryMethod,
      gestationalAge,
      complications,
      notes,
      ...childData
    } = createChildDto;

    // Convert string fields to numbers
    const parsedBirthWeight = birthWeight ? parseFloat(birthWeight) : undefined;
    const parsedBirthHeight = birthHeight ? parseFloat(birthHeight) : undefined;

    const data: Prisma.ChildCreateInput = {
      ...childData,
      dateOfBirth: new Date(childData.dateOfBirth),
      parent: {
        connect: { id: parentId },
      },
      ...(birthFacilityId && {
        birthFacility: {
          connect: { id: birthFacilityId },
        },
      }),
      ...(parsedBirthWeight && { birthWeight: parsedBirthWeight }),
      ...(parsedBirthHeight && { birthHeight: parsedBirthHeight }),
      ...(deliveryMethod && { deliveryMethod }),
      ...(gestationalAge && { gestationalAge }),
      ...(complications && { complications }),
      ...(notes && { notes }),
    };

    return this.prisma.child.create({
      data,
      include: {
        parent: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
        birthFacility: {
          select: {
            id: true,
            name: true,
            type: true,
            code: true,
          },
        },
      },
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ChildWhereInput;
    orderBy?: Prisma.ChildOrderByWithRelationInput;
  }) {
    const { skip, take, where, orderBy } = params;

    const [total, children] = await Promise.all([
      this.prisma.child.count({ where }),
      this.prisma.child.findMany({
        skip,
        take,
        where,
        orderBy,
        include: {
          parent: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  phoneNumber: true,
                },
              },
            },
          },
          birthFacility: {
            select: {
              id: true,
              name: true,
              type: true,
              code: true,
            },
          },
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
          growthRecords: {
            take: 5,
            orderBy: { measurementDate: 'desc' },
            select: {
              id: true,
              measurementDate: true,
              weight: true,
              height: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      children,
    };
  }

  async findOne(id: string) {
    const child = await this.prisma.child.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                profile: true,
              },
            },
          },
        },
        birthFacility: {
          select: {
            id: true,
            name: true,
            type: true,
            code: true,
            county: true,
            subCounty: true,
            address: true,
            phone: true,
            email: true,
          },
        },
        immunizations: {
          orderBy: { dateAdministered: 'desc' },
          include: {
            vaccine: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            facility: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            healthWorker: {
              select: {
                id: true,
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                  },
                },
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
                code: true,
                recommendedAgeDays: true,
              },
            },
          },
        },
        growthRecords: {
          orderBy: { measurementDate: 'desc' },
        },
        developmentRecords: {
          orderBy: { assessmentDate: 'desc' },
        },
        reminders: {
          take: 10,
          orderBy: { scheduledFor: 'asc' },
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
    });

    if (!child) {
      throw new NotFoundException(`Child with ID ${id} not found`);
    }

    return child;
  }

  async findByParentId(parentId: string) {
    return this.prisma.child.findMany({
      where: { parentId },
      include: {
        birthFacility: {
          select: {
            id: true,
            name: true,
            type: true,
            code: true,
          },
        },
        immunizations: {
          take: 3,
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
          take: 3,
          orderBy: { dueDate: 'asc' },
          where: { status: 'SCHEDULED' },
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
    });
  }

  async findByBirthCertificate(birthCertificateNo: string) {
    return this.prisma.child.findUnique({
      where: { birthCertificateNo },
      include: {
        parent: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
        birthFacility: {
          select: {
            id: true,
            name: true,
            type: true,
            code: true,
          },
        },
      },
    });
  }

async update(id: string, updateChildDto: UpdateChildDto & { parentId?: string }): Promise<Child> {
    const {
      parentId,
      birthFacilityId,
      birthWeight,
      birthHeight,
      deliveryMethod,
      gestationalAge,
      complications,
      notes,
      dateOfBirth,
      ...childData
    } = updateChildDto;

    // Convert string fields to numbers
    const parsedBirthWeight = birthWeight ? parseFloat(birthWeight) : undefined;
    const parsedBirthHeight = birthHeight ? parseFloat(birthHeight) : undefined;

    const data: Prisma.ChildUpdateInput = {
      ...childData,
      ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
      ...(parentId && {
        parent: {
          connect: { id: parentId },
        },
      }),
      ...(birthFacilityId && {
        birthFacility: {
          connect: { id: birthFacilityId },
        },
      }),
      ...(parsedBirthWeight !== undefined && { birthWeight: parsedBirthWeight || null }),
      ...(parsedBirthHeight !== undefined && { birthHeight: parsedBirthHeight || null }),
      ...(deliveryMethod && { deliveryMethod }),
      ...(gestationalAge && { gestationalAge }),
      ...(complications && { complications }),
      ...(notes && { notes }),
    };

    return this.prisma.child.update({
      where: { id },
      data,
      include: {
        parent: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
        birthFacility: {
          select: {
            id: true,
            name: true,
            type: true,
            code: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    return this.prisma.child.delete({
      where: { id },
    });
  }

  async count(where?: Prisma.ChildWhereInput): Promise<number> {
    return this.prisma.child.count({ where });
  }

  async getStats() {
    const totalChildren = await this.prisma.child.count();
    
    const childrenByGender = await this.prisma.child.groupBy({
      by: ['gender'],
      _count: true,
    });

    const childrenByAgeGroup = await this.prisma.$queryRaw`
      SELECT 
        CASE 
          WHEN EXTRACT(MONTH FROM AGE(NOW(), "dateOfBirth")) < 12 THEN '0-11 months'
          WHEN EXTRACT(MONTH FROM AGE(NOW(), "dateOfBirth")) BETWEEN 12 AND 23 THEN '12-23 months'
          WHEN EXTRACT(MONTH FROM AGE(NOW(), "dateOfBirth")) BETWEEN 24 AND 59 THEN '24-59 months'
          ELSE '5+ years'
        END as age_group,
        COUNT(*) as count
      FROM children
      GROUP BY age_group
      ORDER BY age_group
    `;

    const recentChildren = await this.prisma.child.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        createdAt: true,
        parent: {
          select: {
            user: {
              select: {
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    const childrenByDate = await this.prisma.$queryRaw`
      SELECT 
        DATE("createdAt") as date,
        COUNT(*) as count
      FROM children
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    return {
      total: totalChildren,
      byGender: childrenByGender.reduce((acc, item) => {
        acc[item.gender] = item._count;
        return acc;
      }, {}),
      byAgeGroup: childrenByAgeGroup,
      recent: recentChildren.map(child => ({
        id: child.id,
        fullName: `${child.firstName} ${child.lastName}`,
        dateOfBirth: child.dateOfBirth,
        gender: child.gender,
        createdAt: child.createdAt,
        parentName: child.parent.user.fullName,
        parentEmail: child.parent.user.email,
      })),
      growth: childrenByDate,
    };
  }

  async calculateAgeInMonths(dateOfBirth: Date): Promise<number> {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    
    let months = (today.getFullYear() - birthDate.getFullYear()) * 12;
    months -= birthDate.getMonth();
    months += today.getMonth();
    
    return months <= 0 ? 0 : months;
  }

  async getFullName(child: any): Promise<string> {
    if (child.middleName) {
      return `${child.firstName} ${child.middleName} ${child.lastName}`;
    }
    return `${child.firstName} ${child.lastName}`;
  }
}