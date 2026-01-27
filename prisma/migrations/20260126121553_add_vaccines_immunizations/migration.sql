-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PARENT', 'HEALTH_WORKER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "OtpType" AS ENUM ('REGISTRATION', 'PASSWORD_RESET', 'EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'TWO_FACTOR');

-- CreateEnum
CREATE TYPE "ImmunizationStatus" AS ENUM ('SCHEDULED', 'PENDING', 'ADMINISTERED', 'MISSED', 'CONTRAINDICATED');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('COVERAGE', 'MISSED_VACCINES', 'FACILITY_PERFORMANCE', 'DEMOGRAPHIC', 'TIMELINESS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('VACCINE_REMINDER', 'APPOINTMENT_CONFIRMATION', 'REPORT_READY', 'SYSTEM_ALERT', 'SECURITY_ALERT');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT');

-- CreateEnum
CREATE TYPE "HealthFacilityType" AS ENUM ('HOSPITAL', 'HEALTH_CENTER', 'DISPENSARY', 'CLINIC', 'MOBILE_CLINIC', 'PRIVATE_PRACTICE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PARENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otps" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "code" TEXT NOT NULL,
    "type" "OtpType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "Gender",
    "profilePicture" TEXT,
    "address" TEXT,
    "county" TEXT,
    "subCounty" TEXT,
    "ward" TEXT,
    "idNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_workers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "qualification" TEXT,
    "specialization" TEXT,
    "facilityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "department" TEXT,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_facilities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HealthFacilityType" NOT NULL,
    "code" TEXT NOT NULL,
    "mflCode" TEXT,
    "county" TEXT NOT NULL,
    "subCounty" TEXT NOT NULL,
    "ward" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "children" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "birthCertificateNo" TEXT,
    "uniqueIdentifier" TEXT NOT NULL,
    "birthFacilityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccines" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "recommendedAgeDays" INTEGER NOT NULL,
    "minAgeDays" INTEGER,
    "maxAgeDays" INTEGER,
    "isBirthDose" BOOLEAN NOT NULL DEFAULT false,
    "isBooster" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaccines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "immunizations" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "healthWorkerId" TEXT NOT NULL,
    "dateAdministered" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ageAtDays" INTEGER NOT NULL,
    "status" "ImmunizationStatus" NOT NULL DEFAULT 'ADMINISTERED',
    "batchNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "immunizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccination_schedules" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ImmunizationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaccination_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "message" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_records" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "measurementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weight" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growth_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_records" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "assessmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motorSkills" TEXT,
    "languageSkills" TEXT,
    "socialSkills" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "development_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "description" TEXT,
    "parameters" TEXT NOT NULL DEFAULT '{}',
    "data" TEXT NOT NULL DEFAULT '{}',
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT DEFAULT '{}',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldData" TEXT,
    "newData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "otps_email_type_isUsed_idx" ON "otps"("email", "type", "isUsed");

-- CreateIndex
CREATE INDEX "otps_phone_type_isUsed_idx" ON "otps"("phone", "type", "isUsed");

-- CreateIndex
CREATE INDEX "otps_expiresAt_idx" ON "otps"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_idNumber_key" ON "user_profiles"("idNumber");

-- CreateIndex
CREATE INDEX "user_profiles_county_subCounty_idx" ON "user_profiles"("county", "subCounty");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "parents_userId_key" ON "parents"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "health_workers_userId_key" ON "health_workers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "health_workers_licenseNumber_key" ON "health_workers"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "admin_profiles_userId_key" ON "admin_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "health_facilities_code_key" ON "health_facilities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "health_facilities_mflCode_key" ON "health_facilities"("mflCode");

-- CreateIndex
CREATE INDEX "health_facilities_county_subCounty_idx" ON "health_facilities"("county", "subCounty");

-- CreateIndex
CREATE INDEX "health_facilities_mflCode_idx" ON "health_facilities"("mflCode");

-- CreateIndex
CREATE UNIQUE INDEX "children_birthCertificateNo_key" ON "children"("birthCertificateNo");

-- CreateIndex
CREATE INDEX "children_parentId_idx" ON "children"("parentId");

-- CreateIndex
CREATE INDEX "children_dateOfBirth_idx" ON "children"("dateOfBirth");

-- CreateIndex
CREATE INDEX "children_birthCertificateNo_idx" ON "children"("birthCertificateNo");

-- CreateIndex
CREATE UNIQUE INDEX "vaccines_code_key" ON "vaccines"("code");

-- CreateIndex
CREATE INDEX "vaccines_code_idx" ON "vaccines"("code");

-- CreateIndex
CREATE INDEX "vaccines_recommendedAgeDays_idx" ON "vaccines"("recommendedAgeDays");

-- CreateIndex
CREATE INDEX "immunizations_childId_idx" ON "immunizations"("childId");

-- CreateIndex
CREATE INDEX "immunizations_vaccineId_idx" ON "immunizations"("vaccineId");

-- CreateIndex
CREATE INDEX "immunizations_dateAdministered_idx" ON "immunizations"("dateAdministered");

-- CreateIndex
CREATE INDEX "immunizations_status_idx" ON "immunizations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "immunizations_childId_vaccineId_key" ON "immunizations"("childId", "vaccineId");

-- CreateIndex
CREATE INDEX "vaccination_schedules_childId_idx" ON "vaccination_schedules"("childId");

-- CreateIndex
CREATE INDEX "vaccination_schedules_dueDate_idx" ON "vaccination_schedules"("dueDate");

-- CreateIndex
CREATE INDEX "vaccination_schedules_status_idx" ON "vaccination_schedules"("status");

-- CreateIndex
CREATE UNIQUE INDEX "vaccination_schedules_childId_vaccineId_key" ON "vaccination_schedules"("childId", "vaccineId");

-- CreateIndex
CREATE INDEX "reminders_childId_idx" ON "reminders"("childId");

-- CreateIndex
CREATE INDEX "reminders_parentId_idx" ON "reminders"("parentId");

-- CreateIndex
CREATE INDEX "reminders_scheduledFor_idx" ON "reminders"("scheduledFor");

-- CreateIndex
CREATE INDEX "reminders_status_idx" ON "reminders"("status");

-- CreateIndex
CREATE INDEX "growth_records_childId_idx" ON "growth_records"("childId");

-- CreateIndex
CREATE INDEX "growth_records_measurementDate_idx" ON "growth_records"("measurementDate");

-- CreateIndex
CREATE INDEX "development_records_childId_idx" ON "development_records"("childId");

-- CreateIndex
CREATE INDEX "development_records_assessmentDate_idx" ON "development_records"("assessmentDate");

-- CreateIndex
CREATE INDEX "reports_type_idx" ON "reports"("type");

-- CreateIndex
CREATE INDEX "reports_generatedAt_idx" ON "reports"("generatedAt");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_idx" ON "audit_logs"("entityType");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_key_idx" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_category_idx" ON "system_settings"("category");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parents" ADD CONSTRAINT "parents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_workers" ADD CONSTRAINT "health_workers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_workers" ADD CONSTRAINT "health_workers_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "health_facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "parents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_birthFacilityId_fkey" FOREIGN KEY ("birthFacilityId") REFERENCES "health_facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "immunizations" ADD CONSTRAINT "immunizations_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "immunizations" ADD CONSTRAINT "immunizations_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "vaccines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "immunizations" ADD CONSTRAINT "immunizations_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "health_facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "immunizations" ADD CONSTRAINT "immunizations_healthWorkerId_fkey" FOREIGN KEY ("healthWorkerId") REFERENCES "health_workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_schedules" ADD CONSTRAINT "vaccination_schedules_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_schedules" ADD CONSTRAINT "vaccination_schedules_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "vaccines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "parents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "vaccines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_records" ADD CONSTRAINT "growth_records_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_records" ADD CONSTRAINT "growth_records_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_records" ADD CONSTRAINT "development_records_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_records" ADD CONSTRAINT "development_records_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
