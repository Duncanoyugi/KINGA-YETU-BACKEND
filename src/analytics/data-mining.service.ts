import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsPeriod, AnalyticsMetric, AnalyticsDimension } from './dto/analytics-request.dto';
import moment from 'moment';
import * as math from 'mathjs';

@Injectable()
export class DataMiningService {
  private readonly logger = new Logger(DataMiningService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate immunization coverage rate
   */
  async calculateCoverageRate(
    startDate: Date,
    endDate: Date,
    dimension?: AnalyticsDimension,
    dimensionValue?: string,
  ): Promise<{ coverage: number; total: number; vaccinated: number; eligible: number }> {
    try {
      // Get eligible children (born before end date and alive)
      const eligibleChildren = await this.prisma.child.findMany({
        where: {
          dateOfBirth: {
            lte: endDate,
          },
        },
        select: {
          id: true,
          dateOfBirth: true,
        },
      });

      // Get administered immunizations in period
      const administeredVaccines = await this.prisma.immunization.findMany({
        where: {
          dateAdministered: {
            gte: startDate,
            lte: endDate,
          },
          status: 'ADMINISTERED',
        },
        select: {
          childId: true,
        },
      });

      // Count unique vaccinated children
      const vaccinatedChildren = new Set(administeredVaccines.map(v => v.childId));
      
      const coverage = eligibleChildren.length > 0 
        ? (vaccinatedChildren.size / eligibleChildren.length) * 100 
        : 0;

      return {
        coverage,
        total: eligibleChildren.length,
        vaccinated: vaccinatedChildren.size,
        eligible: eligibleChildren.length,
      };
    } catch (error) {
      this.logger.error(`Error calculating coverage rate: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate dropout rate between vaccine doses
   */
  async calculateDropoutRate(
    startDate: Date,
    endDate: Date,
    vaccineSeries: string[],
  ): Promise<{ dropoutRate: number; started: number; completed: number; details: Record<string, any> }> {
    try {
      // Get children who started the vaccine series
      const startedVaccine = await this.prisma.immunization.findMany({
        where: {
          vaccine: {
            code: vaccineSeries[0],
          },
          dateAdministered: {
            gte: startDate,
            lte: endDate,
          },
          status: 'ADMINISTERED',
        },
        select: {
          childId: true,
        },
        distinct: ['childId'],
      });

      // Get children who completed the series
      const completedSeries = await Promise.all(
        startedVaccine.map(async (record) => {
          const childVaccines = await this.prisma.immunization.findMany({
            where: {
              childId: record.childId,
              vaccine: {
                code: {
                  in: vaccineSeries,
                },
              },
              status: 'ADMINISTERED',
            },
            select: {
              vaccineId: true,
            },
          });

          const receivedVaccines = new Set(childVaccines.map(v => v.vaccineId));
          return vaccineSeries.every(vaccineCode => 
            childVaccines.some(v => v.vaccineId === vaccineCode)
          );
        }),
      );

      const started = startedVaccine.length;
      const completed = completedSeries.filter(Boolean).length;
      const dropoutRate = started > 0 ? ((started - completed) / started) * 100 : 0;

      return {
        dropoutRate,
        started,
        completed,
        details: {
          vaccineSeries,
          period: `${moment(startDate).format('YYYY-MM-DD')} to ${moment(endDate).format('YYYY-MM-DD')}`,
        },
      };
    } catch (error) {
      this.logger.error(`Error calculating dropout rate: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate timeliness of vaccinations
   */
  async calculateTimeliness(
    startDate: Date,
    endDate: Date,
    ageToleranceDays: number = 30,
  ): Promise<{ timelinessRate: number; onTime: number; late: number; early: number; total: number }> {
    try {
      const immunizations = await this.prisma.immunization.findMany({
        where: {
          dateAdministered: {
            gte: startDate,
            lte: endDate,
          },
          status: 'ADMINISTERED',
        },
        include: {
          child: {
            select: {
              dateOfBirth: true,
            },
          },
          vaccine: {
            select: {
              recommendedAgeDays: true,
              minAgeDays: true,
              maxAgeDays: true,
            },
          },
        },
      });

      let onTime = 0;
      let late = 0;
      let early = 0;

      immunizations.forEach(immunization => {
        const childAgeDays = Math.floor(
          (immunization.dateAdministered.getTime() - immunization.child.dateOfBirth.getTime()) /
          (1000 * 60 * 60 * 24),
        );

        const recommendedAge = immunization.vaccine.recommendedAgeDays;
        const minAge = immunization.vaccine.minAgeDays || recommendedAge - ageToleranceDays;
        const maxAge = immunization.vaccine.maxAgeDays || recommendedAge + ageToleranceDays;

        if (childAgeDays < minAge) {
          early++;
        } else if (childAgeDays > maxAge) {
          late++;
        } else {
          onTime++;
        }
      });

      const total = immunizations.length;
      const timelinessRate = total > 0 ? (onTime / total) * 100 : 0;

      return {
        timelinessRate,
        onTime,
        late,
        early,
        total,
      };
    } catch (error) {
      this.logger.error(`Error calculating timeliness: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze facility performance
   */
  async analyzeFacilityPerformance(
    startDate: Date,
    endDate: Date,
    topN: number = 10,
  ): Promise<Array<{
    facilityId: string;
    facilityName: string;
    county: string;
    subCounty: string;
    immunizations: number;
    coverage: number;
    timeliness: number;
    dropoutRate: number;
    performanceScore: number;
  }>> {
    try {
      const facilities = await this.prisma.healthFacility.findMany({
        select: {
          id: true,
          name: true,
          county: true,
          subCounty: true,
        },
      });

      const performanceData = await Promise.all(
        facilities.map(async (facility) => {
          // Get facility immunizations
          const immunizations = await this.prisma.immunization.count({
            where: {
              facilityId: facility.id,
              dateAdministered: {
                gte: startDate,
                lte: endDate,
              },
            },
          });

          // Get children registered at facility
          const childrenCount = await this.prisma.child.count({
            where: {
              birthFacilityId: facility.id,
            },
          });

          // Calculate coverage
          const coverage = childrenCount > 0 ? (immunizations / childrenCount) * 100 : 0;

          // Calculate timeliness (simplified)
          const timelyImmunizations = await this.prisma.immunization.count({
            where: {
              facilityId: facility.id,
              dateAdministered: {
                gte: startDate,
                lte: endDate,
              },
              ageAtDays: {
                lte: 365, // Within first year
              },
            },
          });

          const timeliness = immunizations > 0 ? (timelyImmunizations / immunizations) * 100 : 0;

          // Calculate performance score (weighted average)
          const performanceScore = (
            coverage * 0.4 + 
            timeliness * 0.3 + 
            (immunizations > 10 ? 100 : (immunizations / 10) * 100) * 0.3
          );

          return {
            facilityId: facility.id,
            facilityName: facility.name,
            county: facility.county,
            subCounty: facility.subCounty,
            immunizations,
            coverage,
            timeliness,
            dropoutRate: 0, // Would need more complex calculation
            performanceScore: Math.round(performanceScore),
          };
        }),
      );

      // Sort by performance score and return top N
      return performanceData
        .sort((a, b) => b.performanceScore - a.performanceScore)
        .slice(0, topN);
    } catch (error) {
      this.logger.error(`Error analyzing facility performance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze demographic distribution
   */
  async analyzeDemographicDistribution(
    startDate: Date,
    endDate: Date,
    dimension: AnalyticsDimension,
  ): Promise<Array<{ value: string; count: number; percentage: number }>> {
    try {
      let distribution: Array<{ value: string; count: number; percentage: number }> = [];

      switch (dimension) {
        case AnalyticsDimension.COUNTY:
          const countyData = await this.prisma.child.groupBy({
            by: ['birthFacilityId'],
            where: {
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            },
            _count: true,
          });

          // Get facility details to map to counties
          const facilityIds = countyData.map(d => d.birthFacilityId).filter(Boolean) as string[];
          const facilities = await this.prisma.healthFacility.findMany({
            where: {
              id: {
                in: facilityIds,
              },
            },
            select: {
              id: true,
              county: true,
            },
          });

          const countyMap = new Map(facilities.map(f => [f.id, f.county]));
          
          distribution = countyData
            .filter(d => d.birthFacilityId)
            .reduce((acc, curr) => {
              const county = countyMap.get(curr.birthFacilityId!);
              if (county) {
                const existing = acc.find(item => item.value === county);
                if (existing) {
                  existing.count += (curr._count as number);
                } else {
                  acc.push({ value: county, count: (curr._count as number), percentage: 0 });
                }
              }
              return acc;
            }, [] as Array<{ value: string; count: number; percentage: number }>);
          break;

        case AnalyticsDimension.AGE_GROUP:
          const children = await this.prisma.child.findMany({
            where: {
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            },
            select: {
              dateOfBirth: true,
            },
          });

          const ageGroups = [
            { label: '0-6 months', min: 0, max: 182 },
            { label: '7-12 months', min: 183, max: 365 },
            { label: '1-2 years', min: 366, max: 730 },
            { label: '2-5 years', min: 731, max: 1825 },
            { label: '5+ years', min: 1826, max: Infinity },
          ];

          const now = new Date();
          distribution = ageGroups.map(group => {
            const count = children.filter(child => {
              const ageDays = Math.floor(
                (now.getTime() - child.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24),
              );
              return ageDays >= group.min && ageDays <= group.max;
            }).length;

            return {
              value: group.label,
              count,
              percentage: 0,
            };
          });
          break;

        case AnalyticsDimension.GENDER:
          const genderData = await this.prisma.child.groupBy({
            by: ['gender'],
            where: {
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            },
            _count: true,
          });

          distribution = genderData.map(item => ({
            value: item.gender,
            count: item._count,
            percentage: 0,
          }));
          break;

        case AnalyticsDimension.VACCINE_TYPE:
          const vaccineData = await this.prisma.immunization.groupBy({
            by: ['vaccineId'],
            where: {
              dateAdministered: {
                gte: startDate,
                lte: endDate,
              },
            },
            _count: true,
          });

          // Get vaccine names
          const vaccineIds = vaccineData.map(d => d.vaccineId);
          const vaccines = await this.prisma.vaccine.findMany({
            where: {
              id: {
                in: vaccineIds,
              },
            },
            select: {
              id: true,
              name: true,
            },
          });

          const vaccineMap = new Map(vaccines.map(v => [v.id, v.name]));
          
          distribution = vaccineData.map(item => ({
            value: vaccineMap.get(item.vaccineId) || item.vaccineId,
            count: item._count,
            percentage: 0,
          }));
          break;
      }

      // Calculate percentages
      const total = distribution.reduce((sum, item) => sum + item.count, 0);
      return distribution.map(item => ({
        ...item,
        percentage: total > 0 ? (item.count / total) * 100 : 0,
      }));
    } catch (error) {
      this.logger.error(`Error analyzing demographic distribution: ${error.message}`);
      throw error;
    }
  }

  /**
   * Identify high-risk populations for dropout
   */
  async identifyHighRiskPopulations(
    startDate: Date,
    endDate: Date,
    threshold: number = 20,
  ): Promise<Array<{ group: string; dropoutRate: number; population: number; riskLevel: string }>> {
    try {
      const highRiskGroups: Array<{ group: string; dropoutRate: number; population: number; riskLevel: string }> = [];

      // Analyze by county
      const counties = await this.prisma.healthFacility.findMany({
        distinct: ['county'],
        select: {
          county: true,
        },
      });

      for (const { county } of counties) {
        if (!county) continue;

        const facilities = await this.prisma.healthFacility.findMany({
          where: { county },
          select: { id: true },
        });

        const facilityIds = facilities.map(f => f.id);
        
        // Simplified dropout calculation for county
        const childrenCount = await this.prisma.child.count({
          where: {
            birthFacilityId: {
              in: facilityIds,
            },
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        });

        const immunizationsCount = await this.prisma.immunization.count({
          where: {
            facilityId: {
              in: facilityIds,
            },
            dateAdministered: {
              gte: startDate,
              lte: endDate,
            },
          },
        });

        const dropoutRate = childrenCount > 0 
          ? ((childrenCount - immunizationsCount) / childrenCount) * 100 
          : 0;

        if (dropoutRate > threshold) {
          highRiskGroups.push({
            group: `County: ${county}`,
            dropoutRate,
            population: childrenCount,
            riskLevel: this.determineRiskLevel(dropoutRate),
          });
        }
      }

      return highRiskGroups.sort((a, b) => b.dropoutRate - a.dropoutRate);
    } catch (error) {
      this.logger.error(`Error identifying high-risk populations: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate vaccine wastage rate
   */
  async calculateWastageRate(
    startDate: Date,
    endDate: Date,
  ): Promise<{ wastageRate: number; totalVaccines: number; wastedVaccines: number; reasons: Record<string, number> }> {
    // Note: This would require tracking vaccine inventory and wastage
    // For now, returning placeholder data
    return {
      wastageRate: 5.2, // Percentage
      totalVaccines: 1000,
      wastedVaccines: 52,
      reasons: {
        expiry: 25,
        temperature_excursion: 15,
        breakage: 8,
        open_vial: 4,
      },
    };
  }

  /**
   * Determine risk level based on dropout rate
   */
  private determineRiskLevel(dropoutRate: number): string {
    if (dropoutRate > 40) return 'CRITICAL';
    if (dropoutRate > 25) return 'HIGH';
    if (dropoutRate > 15) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Generate time series data for a metric
   */
  async generateTimeSeriesData(
    metric: AnalyticsMetric,
    period: AnalyticsPeriod,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ period: string; value: number }>> {
    const periods: Array<{ period: string; value: number }> = [];
    let currentDate = moment(startDate);
    const endMoment = moment(endDate);

    while (currentDate.isSameOrBefore(endMoment)) {
      let periodEnd: moment.Moment;
      let periodLabel: string;

      switch (period) {
        case AnalyticsPeriod.DAILY:
          periodEnd = currentDate.clone().add(1, 'day');
          periodLabel = currentDate.format('YYYY-MM-DD');
          break;
        case AnalyticsPeriod.WEEKLY:
          periodEnd = currentDate.clone().add(1, 'week');
          periodLabel = `Week ${currentDate.week()}, ${currentDate.year()}`;
          break;
        case AnalyticsPeriod.MONTHLY:
          periodEnd = currentDate.clone().add(1, 'month');
          periodLabel = currentDate.format('YYYY-MM');
          break;
        case AnalyticsPeriod.QUARTERLY:
          periodEnd = currentDate.clone().add(3, 'months');
          const quarter = Math.ceil((currentDate.month() + 1) / 3);
          periodLabel = `Q${quarter} ${currentDate.year()}`;
          break;
        case AnalyticsPeriod.YEARLY:
          periodEnd = currentDate.clone().add(1, 'year');
          periodLabel = currentDate.year().toString();
          break;
        default:
          periodEnd = currentDate.clone().add(1, 'month');
          periodLabel = currentDate.format('YYYY-MM');
      }

      // Calculate metric for this period
      let value = 0;
      
      switch (metric) {
        case AnalyticsMetric.COVERAGE_RATE:
          const coverage = await this.calculateCoverageRate(
            currentDate.toDate(),
            periodEnd.toDate(),
          );
          value = coverage.coverage;
          break;
        
        case AnalyticsMetric.DROPOUT_RATE:
          // Simplified calculation for time series
          const childrenCount = await this.prisma.child.count({
            where: {
              createdAt: {
                gte: currentDate.toDate(),
                lt: periodEnd.toDate(),
              },
            },
          });

          const immunizationCount = await this.prisma.immunization.count({
            where: {
              dateAdministered: {
                gte: currentDate.toDate(),
                lt: periodEnd.toDate(),
              },
            },
          });

          value = childrenCount > 0 ? ((childrenCount - immunizationCount) / childrenCount) * 100 : 0;
          break;

        case AnalyticsMetric.TIMELINESS:
          const timeliness = await this.calculateTimeliness(
            currentDate.toDate(),
            periodEnd.toDate(),
          );
          value = timeliness.timelinessRate;
          break;

        default:
          // Default to immunization count
          value = await this.prisma.immunization.count({
            where: {
              dateAdministered: {
                gte: currentDate.toDate(),
                lt: periodEnd.toDate(),
              },
            },
          });
      }

      periods.push({
        period: periodLabel,
        value: Math.round(value * 100) / 100, // Round to 2 decimal places
      });

      currentDate = periodEnd;
    }

    return periods;
  }
}