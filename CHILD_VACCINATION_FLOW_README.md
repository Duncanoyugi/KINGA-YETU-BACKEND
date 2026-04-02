# Child Vaccination Flow After Registration

This document describes the logic of the child vaccination system, specifically what happens immediately after a child is registered in the Kinga Yetu Digital system. It also highlights the roles of each user type at each step.

## Overview

The vaccination flow follows the Kenya Expanded Programme on Immunization (KEPI) schedule. When a child is registered, the system automatically generates a complete vaccination schedule based on the child's date of birth, and then health workers can record administered vaccines.

## User Roles

The system has four main user roles:

| Role | Description |
|------|-------------|
| [`PARENT`](backend/prisma/schema.prisma:10) | Parents/guardians who register and monitor their children's vaccinations |
| [`HEALTH_WORKER`](backend/prisma/schema.prisma:11) | Medical staff at health facilities who administer vaccines |
| [`ADMIN`](backend/prisma/schema.prisma:12) | Facility or county administrators |
| [`SUPER_ADMIN`](backend/prisma/schema.prisma:13) | System super administrators |

## Step-by-Step Flow

### Step 1: Child Registration

**Who can perform this:** [`PARENT`](backend/src/children/children.controller.ts:53), [`HEALTH_WORKER`](backend/src/children/children.controller.ts:53), [`ADMIN`](backend/src/children/children.controller.ts:53), or [`SUPER_ADMIN`](backend/src/children/children.controller.ts:53)

**Endpoint:** `POST /api/children`

**Logic:**
1. User submits child registration data including:
   - First name, middle name, last name
   - Date of birth
   - Gender
   - Birth certificate number (optional)
   - Parent ID (linked to the parent profile)
   - Birth facility information (optional)
   - Birth weight/height (optional)
   - Delivery method (optional)

2. The [`ChildrenService.create()`](backend/src/children/children.service.ts:98) validates the request and creates the child record in the database.

3. The request is routed through [`VaccineSchedulerService.createChildWithSchedule()`](backend/src/children/vaccine-scheduler.service.ts:55) to auto-generate the vaccination schedule.

**Code Reference:**
```typescript
// backend/src/children/children.controller.ts - Lines 62-79
@Post()
@Roles(UserRole.PARENT, UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
async create(
  @Body() createChildDto: CreateChildDto,
  @Request() req: any,
): Promise<ChildResponseDto> {
  // Use VaccineSchedulerService to auto-generate vaccination schedule
  const result = await this.vaccineSchedulerService.createChildWithSchedule(cleanedDto, req.user.id);
  return result.child;
}
```

---

### Step 2: Automatic Vaccination Schedule Generation

**Who performs this:** System (automated)

**Logic:** Immediately after child registration, the [`VaccineSchedulerService.generateVaccinationSchedules()`](backend/src/children/vaccine-scheduler.service.ts:76) generates all vaccination schedules based on the KEPI schedule.

**KEPI Schedule Used:**

| Age | Vaccine Code | Vaccine Name |
|-----|--------------|---------------|
| Birth | `BCG` | Tuberculosis vaccine |
| Birth | `OPV0` | Oral Polio Vaccine at birth |
| Birth | `HEPB0` | Hepatitis B birth dose |
| 6 weeks | `OPV1` | Oral Polio Vaccine 1 |
| 6 weeks | `DPT1` | DPT-HepB-Hib 1 (Pentavalent 1) |
| 6 weeks | `PCV1` | Pneumococcal Conjugate Vaccine 1 |
| 6 weeks | `ROTA1` | Rotavirus Vaccine 1 |
| 10 weeks | `OPV2` | Oral Polio Vaccine 2 |
| 10 weeks | `DPT2` | DPT-HepB-Hib 2 (Pentavalent 2) |
| 10 weeks | `PCV2` | Pneumococcal Conjugate Vaccine 2 |
| 10 weeks | `ROTA2` | Rotavirus Vaccine 2 |
| 14 weeks | `OPV3` | Oral Polio Vaccine 3 |
| 14 weeks | `DPT3` | DPT-HepB-Hib 3 (Pentavalent 3) |
| 14 weeks | `PCV3` | Pneumococcal Conjugate Vaccine 3 |
| 6 months | `VITA` | Vitamin A Supplement |
| 9 months | `MEASLES` | Measles Vaccine |
| 9 months | `YELLOW` | Yellow Fever Vaccine |
| 9 months | `VITA9` | Vitamin A at 9 months |
| 18 months | `MEASLES2` | Measles Second Dose |
| 18 months | `VITA18` | Vitamin A at 18 months |
| 2 years | `VITA2` | Vitamin A every 6 months from 2 years |

**Code Reference:**
```typescript
// backend/src/children/vaccine-scheduler.service.ts - Lines 10-47
private readonly KEPI_SCHEDULE = [
  // Birth
  { vaccineCode: 'BCG', ageDays: 0, name: 'BCG', description: 'Tuberculosis vaccine' },
  { vaccineCode: 'OPV0', ageDays: 0, name: 'OPV 0', description: 'Oral Polio Vaccine at birth' },
  { vaccineCode: 'HEPB0', ageDays: 0, name: 'Hepatitis B 0', description: 'Hepatitis B birth dose' },
  // 6 weeks
  { vaccineCode: 'OPV1', ageDays: 42, name: 'OPV 1', description: 'Oral Polio Vaccine 1' },
  // ... more vaccines
];
```

**Calculations:**
- For each vaccine, the due date is calculated as: `dateOfBirth + recommendedAgeDays`
- Minimum age window: `recommendedAgeDays - 14 days` (2 weeks before)
- Maximum age window: `recommendedAgeDays + 30 days` (1 month after)

**Schedule Status:** Each schedule is created with [`SCHEDULED`](backend/prisma/schema.prisma:38) status.

---

### Step 3: Recording Immunization (Vaccine Administration)

**Who can perform this:** [`HEALTH_WORKER`](backend/src/immunizations/immunizations.controller.ts:41), [`ADMIN`](backend/src/immunizations/immunizations.controller.ts:41), or [`SUPER_ADMIN`](backend/src/immunizations/immunizations.controller.ts:41)

**Endpoint:** `POST /api/immunizations`

**Logic:**
1. Health worker submits immunization data including:
   - Child ID
   - Vaccine ID
   - Facility ID
   - Health worker ID
   - Date administered
   - Age at administration (in days)
   - Batch number (optional)
   - Administration site (optional)
   - Dosage (optional)
   - Notes (optional)

2. The [`ImmunizationsService.create()`](backend/src/Immunizations/immunizations.service.ts:81) validates:
   - Child exists
   - Vaccine exists
   - Facility exists
   - Health worker exists and belongs to the facility
   - User is authorized (health worker, admin, or super admin)
   - Vaccine is valid for child's age
   - Duplicate immunization doesn't exist

3. The system:
   - Creates the immunization record with [`ADMINISTERED`](backend/prisma/schema.prisma:38) status
   - Updates the corresponding vaccination schedule status to [`COMPLETED`](backend/prisma/schema.prisma:46)

**Code Reference:**
```typescript
// backend/src/immunizations/immunizations.controller.ts - Lines 40-56
@Post()
@Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
async create(
  @Body() recordImmunizationDto: RecordImmunizationDto,
  @Request() req: any,
): Promise<ImmunizationResponseDto> {
  return this.immunizationsService.create(recordImmunizationDto, req.user.id);
}

// backend/src/immunizations/immunizations.service.ts - Lines 169-180
// Update vaccination schedule status
await this.updateVaccinationSchedule(
  recordImmunizationDto.childId,
  recordImmunizationDto.vaccineId,
  'ADMINISTERED',
);

// Create immunization record
const immunization = await this.prisma.immunization.create({
  data: {
    ...recordImmunizationDto,
    dateAdministered: recordImmunizationDto.dateAdministered,
    status: 'ADMINISTERED',
  },
});
```

---

### Step 4: Reminder Notifications

**Who performs this:** System (automated via [`ReminderEngineService`](backend/src/reminders/reminder-engine.service.ts))

**Logic:**
1. The reminder engine runs on a cron schedule (daily)
2. It queries all [`SCHEDULED`](backend/prisma/schema.prisma:38) vaccination schedules with due dates within a specific range
3. For each upcoming vaccination, it creates reminders of types:
   - [`VACCINE_DUE`](backend/prisma/schema.prisma:55) - 7 days before due date
   - [`VACCINE_OVERDUE`](backend/prisma/schema.prisma:56) - after due date passes

4. Reminders are sent to parents via:
   - Email
   - SMS
   - Push notifications

**Code Reference:**
```typescript
// backend/src/reminders/reminder-engine.service.ts - Lines 21-77
async generateVaccinationReminders(
  startDate: Date,
  endDate: Date,
  facilityId?: string,
  reminderTypes?: ReminderType[],
): Promise<{ created: number; skipped: number }> {
  // Get upcoming vaccination schedules
  const schedules = await this.prisma.vaccinationSchedule.findMany({
    where: {
      dueDate: { gte: startDate, lte: endDate },
      status: ImmunizationStatus.SCHEDULED,
    },
    include: {
      child: { include: { parent: { include: { user: true } } } },
      vaccine: true,
    },
  });
  // Create reminders for each schedule...
}
```

---

### Step 5: Parent Viewing Vaccination Schedule

**Who can perform this:** [`PARENT`](backend/src/children/children.controller.ts:53)

**Endpoints:**
- `GET /api/children` - List all children for the parent
- `GET /api/children/:id` - Get specific child with schedules

**Logic:**
1. Parents can view their children's:
   - Registration details
   - Vaccination schedules (due dates and status)
   - Immunization history (administered vaccines)
   - Growth records

**Code Reference:**
```typescript
// backend/src/children/children.service.ts - Lines 64-77
immunizations: child.immunizations?.map(immunization => ({
  id: immunization.id,
  vaccineId: immunization.vaccine.id,
  vaccineName: immunization.vaccine.name,
  dateAdministered: immunization.dateAdministered,
  status: immunization.status,
})),
schedules: child.schedules?.map(schedule => ({
  id: schedule.id,
  vaccineId: schedule.vaccine.id,
  vaccineName: schedule.vaccine.name,
  dueDate: schedule.dueDate,
  status: schedule.status,
})),
```

---

## Status Flow Diagram

```
Child Registration
        │
        ▼
┌───────────────────┐
│ Generate KEPI     │
│ Vaccination       │
│ Schedules         │
│ (SCHEDULED)       │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Parent receives  │
│ reminders        │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Health worker    │
│ administers      │
│ vaccine          │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Update schedule   │
│ to COMPLETED      │
│ Create imm.unz   │
│ (ADMINISTERED)   │
└───────────────────┘
```

## API Endpoints Summary

| Method | Endpoint | Role | Description |
|--------|-----------|------|--------------|
| `POST` | `/api/children` | PARENT, HEALTH_WORKER, ADMIN, SUPER_ADMIN | Register a new child |
| `GET` | `/api/children` | PARENT, HEALTH_WORKER, ADMIN, SUPER_ADMIN | List children |
| `GET` | `/api/children/:id` | PARENT, HEALTH_WORKER, ADMIN, SUPER_ADMIN | Get child details with schedules |
| `POST` | `/api/immunizations` | HEALTH_WORKER, ADMIN, SUPER_ADMIN | Record vaccine administration |
| `GET` | `/api/immunizations` | HEALTH_WORKER, ADMIN, SUPER_ADMIN | List immunizations |
| `GET` | `/api/schedules` | PARENT, HEALTH_WORKER, ADMIN, SUPER_ADMIN | Get vaccination schedules |

## Database Schema Relationships

```
User ─────┬─── ParentProfile ──────── Child ──────── VaccinationSchedule
          │                                                    │
          ├─── HealthWorker ────────── Immunization ◄──────── Vaccine
          │        │                      │
          │        └──── HealthFacility ─┘
          │
          └─── AdminProfile
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|-------------|
| `NotFoundException` | Child, vaccine, facility, or health worker not found | Verify IDs are correct |
| `ConflictException` | Duplicate immunization (vaccine already given) | Check child's immunization history |
| `BadRequestException` | Invalid vaccine administration age | Verify child is within eligible age range |
| `ForbiddenException` | User not authorized to record immunizations | Ensure user has appropriate role |
| `UnauthorizedException` | No valid JWT token | Login and obtain valid token |