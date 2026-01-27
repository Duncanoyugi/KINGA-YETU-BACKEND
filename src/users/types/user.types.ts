export type UserWithRelations = {
  id: string;
  email: string;
  phoneNumber?: string;
  fullName: string;
  role: string;
  isActive: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  profile?: {
    dateOfBirth?: Date;
    gender?: string;
    profilePicture?: string;
    address?: string;
    county?: string;
    subCounty?: string;
    ward?: string;
    idNumber?: string;
  };
  parentProfile?: {
    emergencyContact?: string;
    emergencyPhone?: string;
  };
  healthWorker?: {
    licenseNumber?: string;
    qualification?: string;
    specialization?: string;
    facility?: {
      id: string;
      name: string;
      code: string;
    };
  };
  adminProfile?: {
    department?: string;
    permissions: string;
  };
};

export type UserStats = {
  total: number;
  byRole: Record<string, number>;
  recent: Array<{
    id: string;
    fullName: string;
    email: string;
    role: string;
    createdAt: Date;
  }>;
  growth: Array<{
    date: Date;
    count: number;
  }>;
};