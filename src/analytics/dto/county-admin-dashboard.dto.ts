export class SubCountyStatsDto {
  name: string;
  coverage: number;
  facilities: number;
  population: string;
  target: number;
  healthWorkers: number;
  children: string;
  status: string;
  trend: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export class FacilityStatsDto {
  name: string;
  coverage: number;
  status: string;
  children: string;
  healthWorkers: number;
  vaccines: number;
  lastUpdated: string;
  type: string;
  contact: string;
}

export class ResourceDto {
  label: string;
  value: number;
  status: string;
  active?: number;
  lastChecked: string;
  capacity?: string;
}

export class ActivityDto {
  action: string;
  facility: string;
  time: string;
  user: string;
  alert?: boolean;
}

export class AppointmentDto {
  child: string;
  vaccine: string;
  facility: string;
  time: string;
  status: string;
  parent: string;
}

export class DashboardStatDto {
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
  color: string;
  bgColor: string;
  textColor: string;
  description: string;
}

export class CoverageAlertDto {
  type: string;
  message: string;
  facilities: number;
  severity: string;
}

export class CountyAdminDashboardDto {
  stats: DashboardStatDto[];
  subCountyStats: SubCountyStatsDto[];
  facilityStats: FacilityStatsDto[];
  resources: ResourceDto[];
  recentActivities: ActivityDto[];
  upcomingAppointments: AppointmentDto[];
  coverageAlerts: CoverageAlertDto[];
  totalCoverage: number;
  totalFacilities: number;
  totalChildren: number;
  totalHealthWorkers: number;
  previousMonthCoverage: number;
  coverageTrend: number;
}
