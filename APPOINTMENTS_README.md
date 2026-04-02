# Appointments (Vaccination Schedule) Logic and Implementation

## Overview

The appointments system in Kinga Yetu Digital is built around **vaccination scheduling** for children. Instead of traditional "appointments" with time slots, this system generates a personalized vaccination schedule for each child based on the Kenya Expanded Programme on Immunization (KEPI) schedule.

## Core Concepts

### 1. Vaccination Schedule vs Traditional Appointments

| Traditional Appointments | Vaccination Schedule |
|------------------------|---------------------|
| Fixed time slots | Date-based due dates |
| One-time booking | Ongoing schedule |
| Single event | Series of events |
| Manual scheduling | Automatic generation |

### 2. KEPI Schedule (Kenya Standard)

The system follows Kenya's official immunization schedule:

| Age | Vaccines | Code |
|-----|----------|------|
| Birth | BCG, OPV0, HEPB0 | 0 days |
| 6 weeks | OPV1, PENTA1, PCV1, ROTA1 | 42 days |
| 10 weeks | OPV2, PENTA2, PCV2, ROTA2 | 70 days |
| 14 weeks | OPV3, PENTA3, PCV3, IPV | 98 days |
| 6 months | Vitamin A | 180 days |
| 9 months | Measles, Yellow Fever, Vitamin A | 270 days |
| 18 months | Measles 2, Vitamin A | 540 days |
| 2+ years | Vitamin A (every 6 months) | 730+ days |

---

## Database Schema

### VaccinationSchedule Model

```
prisma/schema.prisma (lines 366-383)
```

```prisma
model VaccinationSchedule {
  id        String        @id @default(cuid())
  childId   String        // Reference to Child
  parentId  String        // Reference to Parent
  vaccineId String        // Reference to Vaccine
  dueDate   DateTime      // When vaccine is due
  status    ScheduleStatus @default(PENDING)
  notes     String?       // Optional notes
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  
  // Relations
  child     Child          @relation(...)
  vaccine   Vaccine        @relation(...)
  parent    Parent         @relation(...)
}
```

### ScheduleStatus Enum

- `PENDING` - Schedule created but not yet confirmed
- `SCHEDULED` - Confirmed and awaiting administration
- `ADMINISTERED` - Vaccine has been given
- `MISSED` - Vaccine was not given on time
- `CANCELLED` - Schedule cancelled (contraindication)

---

## Implementation Architecture

### Key Services

#### 1. [`KenyaScheduleService`](backend/src/vaccines/keni-schedule.service.ts:1)
Provides the KEPI schedule definition with all vaccine details:

- Vaccine codes and names
- Recommended age in days
- Min/max age windows
- Administration route and site
- Dosage information
- Contraindications

#### 2. [`ScheduleCalculatorService`](backend/src/schedules/schedule-calculator.service.ts:7)
Handles schedule generation logic:

- [`generateScheduleForChild()`](backend/src/schedules/schedule-calculator.service.ts:15) - Creates schedule from KEPI
- [`generateCatchupSchedule()`](backend/src/schedules/schedule-calculator.service.ts:161) - Handles late registrations
- [`getUpcomingSchedules()`](backend/src/schedules/schedule-calculator.service.ts:264) - Queries future vaccines
- [`calculateChildScheduleStats()`](backend/src/schedules/schedule-calculator.service.ts:422) - Statistics

#### 3. [`SchedulesService`](backend/src/schedules/schedules.service.ts:15)
Public API for schedule management:

- [`generateSchedule()`](backend/src/schedules/schedules.service.ts:83) - POST /schedules/generate
- [`regenerateSchedule()`](backend/src/schedules/schedules.service.ts:131) - POST /schedules/regenerate
- [`findAll()`](backend/src/schedules/schedules.service.ts:258) - GET /schedules
- [`reschedule()`](backend/src/schedules/schedules.service.ts) - PATCH /schedules/:id/reschedule

#### 4. [`VaccineSchedulerService`](backend/src/children/vaccine-scheduler.service.ts:8)
Legacy service for backward compatibility - handles direct schedule generation.

---

## Schedule Generation Logic

### Flow Diagram

```
Child Registration
       │
       ▼
┌──────────────────┐
│ Check if Schedule│
│    Exists?       │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
   YES        NO
    │         │
    ▼         ▼
┌────────┐  ┌────────────────────┐
│ Return │  │ Get Child DOB      │
│Existing│  └─────────┬──────────┘
│Schedule│            │
         │            ▼
         │  ┌─────────────────────┐
         │  │ Iterate KEPI Schedule│
         │  └─────────┬───────────┘
         │            │
         │            ▼
         │  ┌──────────────────────┐
         │  │ For Each Vaccine:    │
         │  │ 1. Check if exists  │
         │  │ 2. Calculate dueDate│
         │  │ 3. Determine status │
         │  │ 4. Create/Update    │
         │  └──────────┬───────────┘
         │             │
         │             ▼
         │  ┌─────────────────────┐
         │  │ Generate Reminders  │
         │  │ (7 days, 1 day)     │
         │  └─────────────────────┘
         │             │
         │             ▼
         └────────► Return Result
```

### Detailed Logic

#### Step 1: Calculate Due Date

```typescript
// From ScheduleCalculatorService (line 96-98)
const dueDate = new Date(dateOfBirth);
dueDate.setDate(dueDate.getDate() + vaccineData.recommendedAgeDays);
```

**Example**: Child born on January 1, 2026
- OPV1 (6 weeks = 42 days): Due January 1 + 42 = February 12, 2026

#### Step 2: Determine Status

```typescript
// From ScheduleCalculatorService (line 100-109)
const isOverdue = dueDate < today;
const isMissed = childAgeDays > (vaccineData.maxAgeDays || Infinity);

if (isMissed) {
  status = ImmunizationStatus.MISSED;
} else if (isOverdue) {
  status = ImmunizationStatus.SCHEDULED; // Keep as scheduled for catchup
}
```

#### Step 3: Skip Already Administered

```typescript
// From ScheduleCalculatorService (line 90-94)
if (administeredVaccineIds.includes(vaccine.id)) {
  skipped++;
  continue; // Skip this vaccine
}
```

---

## Catch-up Schedule Logic

When a child registers late (after some vaccine due dates have passed), the system generates a catch-up schedule.

### Catch-up Rules

1. **Window Extension**: Grace period of 30 days beyond max age
2. **Priority Sorting**: Overdue vaccines get HIGH priority
3. **Scheduling**: Overdue vaccines scheduled within 7 days

```typescript
// From ScheduleCalculatorService (line 205-222)
// Check if child is within catchup window
const catchupWindow = maxAge + 30; // 30-day grace period

if (childAgeDays > catchupWindow) {
  skipped++;
  continue;
}

// Calculate catchup due date
if (dueDate < today) {
  // Schedule catchup within 7 days
  dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 7);
}
```

---

## Reminders System

Reminders are automatically generated when schedules are created.

### Reminder Schedule

| Reminder Type | Timing | Created By |
|---------------|--------|------------|
| 7-day reminder | Due date - 7 days | `generateRemindersForChild()` |
| 1-day reminder | Due date - 1 day | `generateRemindersForChild()` |

### Reminder Creation Flow

```
Schedule Created
       │
       ▼
┌──────────────────┐
│ Get Child/Parent │
│    Info          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Calculate 7-day  │
│   Reminder       │
└────────┬─────────┘
         │
    ┌────┴────┐
    │Date ≥   │
    │Today?   │
    └────┬────┘
         │
    ┌────┴────┐
    │  YES    │
    └────┬────┘
         │
         ▼
┌──────────────────┐
│ Create Reminder  │
│   (SMS/Email)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Calculate 1-day  │
│   Reminder       │
└────────┬─────────┘
         │ (repeat)
         ▼
```

---

## API Endpoints

### Schedule Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/schedules/generate` | Generate schedule for child |
| POST | `/schedules/regenerate` | Regenerate (with force option) |
| GET | `/schedules` | List all schedules (paginated) |
| GET | `/schedules/:id` | Get single schedule |
| GET | `/schedules/child/:childId` | Get child's full schedule |
| PATCH | `/schedules/:id/reschedule` | Reschedule vaccine |
| PATCH | `/schedules/:id/contraindicated` | Mark as contraindicated |

### Query Parameters

```typescript
// GET /schedules?page=1&limit=10&childId=xxx&status=SCHEDULED&overdue=true&upcoming=true
```

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 10) |
| childId | string | Filter by child |
| vaccineId | string | Filter by vaccine |
| status | ScheduleStatus | Filter by status |
| overdue | boolean | Show only overdue |
| upcoming | boolean | Show only upcoming (30 days) |
| startDate | string | Filter by date range |
| endDate | string | Filter by date range |
| search | string | Search child/vaccine name |

### Statistics Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/schedules/stats` | Overall schedule statistics |
| GET | `/schedules/upcoming` | Upcoming vaccines (default: 30 days) |
| GET | `/schedules/overdue` | Overdue vaccines |
| GET | `/schedules/child/:childId/stats` | Child-specific stats |

---

## Usage Examples

### 1. Generate Schedule for New Child

```bash
POST /api/schedules/generate
{
  "childId": "child_abc123",
  "dateOfBirth": "2026-01-15",
  "includeCatchup": true,
  "generateReminders": true,
  "reminderDaysBefore": 7
}
```

**Response**:
```json
{
  "message": "Schedule generated successfully. 14 reminders created.",
  "created": 17,
  "updated": 0,
  "skipped": 0
}
```

### 2. View Child's Upcoming Vaccines

```bash
GET /api/schedules/child/child_abc123
```

**Response**:
```json
[
  {
    "id": "schedule_xyz",
    "childId": "child_abc123",
    "vaccineId": "vaccine_opv1",
    "vaccine": {
      "code": "OPV1",
      "name": "Oral Polio Vaccine 1"
    },
    "dueDate": "2026-02-26T00:00:00.000Z",
    "status": "SCHEDULED",
    "ageDescription": "6 weeks",
    "daysUntilDue": 42,
    "isOverdue": false,
    "isUpcoming": true
  },
  ...
]
```

### 3. Reschedule a Vaccine

```bash
PATCH /api/schedules/schedule_xyz/reschedule
{
  "newDate": "2026-03-01",
  "reason": "Child was ill"
}
```

---

## Status Flow

```
PENDING ──► SCHEDULED ──► COMPLETED
    │            │
    │            └──────► MISSED (auto when overdue)
    │                     │
    └─────────────────────┴───► CONTRAINDICATED/CANCELLED
```

### Automatic Status Updates

1. **MISSED Status**: Automatically set when due date passes and vaccine not administered
2. **COMPLETED Status**: Set when immunization is recorded via `/immunizations` endpoint

---

## Recording Immunization (Marking as Administered)

### How It Works

When a health worker records that a vaccine was administered to a child:

1. **API Call**: `POST /immunizations`
2. **Validation**: Check child, vaccine, facility, health worker exist
3. **Age Validation**: Ensure child is within valid age window for vaccine
4. **Duplicate Check**: Prevent same vaccine from being recorded twice
5. **Update Schedule**: Change schedule status from `SCHEDULED` to `COMPLETED`
6. **Create Record**: Store immunization details

### API Endpoint

```bash
POST /api/immunizations
Authorization: Bearer <token>
Content-Type: application/json

{
  "childId": "child_abc123",
  "vaccineId": "vaccine_opv1",
  "facilityId": "facility_xyz",
  "healthWorkerId": "healthworker_123",
  "dateAdministered": "2026-02-26",
  "ageAtDays": 42,
  "batchNumber": "ABC123",
  "administeredBy": "Dr. Smith"
}
```

### Implementation Details

From [`ImmunizationsService.create()`](backend/src/immunizations/immunizations.service.ts:81):

```typescript
// Step 1: Validate all entities exist (lines 82-127)
const child = await this.prisma.child.findUnique({ where: { id: childId } });
const vaccine = await this.prisma.vaccine.findUnique({ where: { id: vaccineId } });
const facility = await this.prisma.healthFacility.findUnique({ where: { id: facilityId } });
const healthWorker = await this.prisma.healthWorker.findUnique({ where: { id: healthWorkerId } });

// Step 2: Validate vaccine age (lines 145-154)
const validation = await this.vaccinesService.validateVaccineForChild(vaccine.code, childAgeDays);
if (!validation.isValid) {
  throw new BadRequestException(validation.message);
}

// Step 3: Check for duplicates (lines 156-167)
const existingImmunization = await this.prisma.immunization.findFirst({
  where: { childId, vaccineId, status: 'ADMINISTERED' },
});
if (existingImmunization) {
  throw new ConflictException('This vaccine has already been administered');
}

// Step 4: Update vaccination schedule status (lines 169-174)
await this.updateVaccinationSchedule(childId, vaccineId, 'ADMINISTERED');

// Step 5: Create immunization record (lines 176-184)
const immunization = await this.prisma.immunization.create({
  data: { ...recordImmunizationDto, status: 'ADMINISTERED' },
});
```

### The Key: `updateVaccinationSchedule()` Method

This is the crucial method that marks the schedule as completed:

```typescript
// From ImmunizationsService (lines 238-253)
private async updateVaccinationSchedule(
  childId: string,
  vaccineId: string,
  status: ImmunizationStatus,
): Promise<void> {
  await this.prisma.vaccinationSchedule.updateMany({
    where: {
      childId,
      vaccineId,
      status: 'SCHEDULED',  // Only update SCHEDULED schedules
    },
    data: {
      status: status === ImmunizationStatus.ADMINISTERED ? 'COMPLETED' : status,
    },
  });
}
```

### Status Mapping

| Immunization Status | Schedule Status |
|--------------------|-----------------|
| ADMINISTERED | COMPLETED |
| OTHER | (same) |

### What Gets Recorded

The immunization record captures:

- Child & vaccine information
- Facility where administered
- Health worker who administered
- Date and time of administration
- Child's age in days at administration
- Batch number & manufacturer
- Administration site & dosage
- Any adverse reactions
- Contraindications observed
- Additional notes

### Flow Diagram

```
Health Worker Records Vaccine
           │
           ▼
    ┌─────────────┐
    │ Validate    │
    │ Child/Vaccine│
    │/Facility/  │
    │HealthWorker │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ Validate    │
    │ Age Window  │
    └──────┬──────┘
           │
    ┌─────┴─────┐
    │ Valid?    │
    └─────┬─────┘
         │
    ┌────┴────┐
    │  YES    │
    └────┬────┘
         │
         ▼
    ┌─────────────┐
    │ Check for   │
    │ Duplicate   │
    └──────┬──────┘
           │
    ┌─────┴─────┐
    │ Not exists │
    └─────┬─────┘
         │
    ┌────┴────┐
    │  YES    │
    └────┬────┘
         │
         ▼
    ┌─────────────┐
    │ UPDATE      │
    │ Schedule:   │
    │ SCHEDULED   │
    │ ──────────► │
    │ COMPLETED   │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ CREATE      │
    │ Immunization│
    │ Record      │
    └─────────────┘
           │
           ▼
    ┌─────────────┐
    │ Return      │
    │ Success     │
    └─────────────┘
```

---

## Integration with Other Modules

### Immunizations Module

When a vaccine is administered, the system:
1. Updates schedule status to `ADMINISTERED`
2. Creates immunization record
3. Updates child's vaccination coverage stats

### Reminders Module

Schedules feed into the reminder system:
- Reminders created at 7 days and 1 day before due date
- Can be sent via SMS, Email, or Push notification
- Reminder status tracked (PENDING, SENT, FAILED)

### Analytics Module

Schedule data powers analytics:
- Coverage rates by vaccine, facility, county
- Timeliness calculations (within ±7 days of due date)
- Missed vaccine tracking
- Predictive analytics for dropout risk

---

## Key Features Summary

| Feature | Implementation |
|---------|----------------|
| Auto-schedule generation | KEPI-based calculation |
| Catch-up scheduling | 30-day grace period, 7-day urgency |
| Reminder automation | 7-day and 1-day before due |
| Status tracking | PENDING → SCHEDULED → ADMINISTERED |
| Overdue detection | Automatic based on due date |
| Rescheduling | Manual date change with reason |
| Contraindication | Mark cancelled with reason |
| Search/Filter | Multiple query parameters |
| Statistics | Real-time coverage calculation |

---

## File Structure

```
backend/src/
├── schedules/
│   ├── schedules.controller.ts    # REST endpoints
│   ├── schedules.service.ts       # Business logic
│   ├── schedule-calculator.service.ts # Core calculations
│   └── dto/
│       ├── generate-schedule.dto.ts
│       ├── schedule-response.dto.ts
│       └── upcoming-vaccines.dto.ts
├── children/
│   └── vaccine-scheduler.service.ts # Legacy scheduler
└── vaccines/
    └── keni-schedule.service.ts # KEPI schedule definition
```

---

## Testing

See test files in `backend/Rest-Client/vaccination-flow-test.http` for API testing examples.

```bash
# Test schedule generation
POST http://localhost:3000/api/schedules/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "childId": "child_abc123",
  "dateOfBirth": "2026-01-15",
  "includeCatchup": true,
  "generateReminders": true
}
```
