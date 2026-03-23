# Kinga Yetu Digital - Backend System Explanation

## Table of Contents
1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [Core Modules](#core-modules)
5. [Authentication & Authorization](#authentication--authorization)
6. [User Roles](#user-roles)
7. [Key Workflows](#key-workflows)
8. [API Endpoints Overview](#api-endpoints-overview)
9. [KEPI Schedule Reference](#kepi-schedule-reference)
10. [System Flow Examples](#system-flow-examples)

---

## System Overview

**Kinga Yetu Digital** (Swahili for "Our Children") is a comprehensive child health and immunization tracking system designed specifically for Kenya's healthcare infrastructure. The system enables:

- **Child Registration**: Register newborns and track their health journey from birth
- **Immunization Tracking**: Monitor vaccination schedules based on Kenya's KEPI (Kenya Expanded Programme on Immunization) schedule
- **Growth Monitoring**: Record and track children's growth metrics over time
- **Reminder System**: Send automated reminders to parents about upcoming vaccinations
- **Health Facility Management**: Manage healthcare facilities, health workers, and their activities
- **Analytics & Reporting**: Generate comprehensive reports on immunization coverage, missed vaccines, and health trends
- **Multi-channel Notifications**: Send notifications via email, SMS, and push notifications

The system is designed to work in both online and offline-capable environments, with a frontend that can function offline and sync when connectivity is restored.

---

## Technology Stack

### Backend Technologies

| Technology | Purpose |
|------------|---------|
| **NestJS** | Node.js framework for building scalable server-side applications |
| **PostgreSQL** | Primary relational database for storing all data |
| **Prisma ORM** | Database toolkit for type-safe database operations |
| **JWT (JSON Web Tokens)** | Authentication mechanism for stateless API requests |
| **Passport.js** | Authentication middleware for Node.js |
| **Bcrypt** | Password hashing for secure password storage |
| **Nodemailer** | Email sending functionality |
| **Twilio** | SMS sending functionality (via their API) |

### Key Dependencies

```json
{
  "@nestjs/common": "^10.x",
  "@nestjs/core": "^10.x",
  "@nestjs/jwt": "^10.x",
  "@nestjs/passport": "^10.x",
  "@nestjs/config": "^3.x",
  "@prisma/client": "^5.x",
  "passport": "^0.7.x",
  "passport-jwt": "^4.0.x",
  "bcrypt": "^5.x",
  "nodemailer": "^6.x"
}
```

---

## Database Schema

The database consists of 14 interconnected models that store all system data. Here's a detailed breakdown:

### 1. User Model
The central authentication and profile entity.

```prisma
model User {
  id                 String    @id @default(cuid())
  email              String    @unique
  phoneNumber        String?   @unique
  password           String
  fullName           String
  role               UserRole  @default(PARENT)
  isActive           Boolean   @default(true)
  isEmailVerified    Boolean   @default(false)
  isPhoneVerified    Boolean   @default(false)
  lastLoginAt        DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}
```

**Fields:**
- `id`: Unique identifier (CUID)
- `email`: User's email (unique, required for login)
- `phoneNumber`: Optional phone number for SMS notifications
- `password`: Hashed password
- `fullName`: User's full name
- `role`: User's role in the system (PARENT, HEALTH_WORKER, ADMIN, SUPER_ADMIN)
- `isActive`: Whether the account is active
- `isEmailVerified`: Whether email has been verified
- `isPhoneVerified`: Whether phone has been verified
- `lastLoginAt`: Timestamp of last login

### 2. Parent Model
Links to User and stores parent-specific information.

```prisma
model Parent {
  id               String   @id @default(cuid())
  userId           String   @unique
  emergencyContact String?
  emergencyPhone   String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  children         Child[]
  user             User     @relation(fields: [userId], references: [id])
  reminders        Reminder[]
}
```

**Purpose:** Represents a parent/guardian who can have multiple children registered in the system.

### 3. Child Model
The core entity representing a child in the system.

```prisma
model Child {
  id                 String   @id @default(cuid())
  parentId           String
  firstName          String
  middleName         String?
  lastName           String
  dateOfBirth        DateTime
  gender             Gender
  birthCertificateNo String?  @unique
  uniqueIdentifier   String   @default(cuid())
  birthFacilityId    String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  birthFacility      HealthFacility?
  parent             Parent   @relation(fields: [parentId], references: [id])
  developmentRecords DevelopmentRecord[]
  growthRecords      GrowthRecord[]
  immunizations      Immunization[]
  reminders          Reminder[]
  schedules          VaccinationSchedule[]
}
```

**Fields:**
- `parentId`: Links to the Parent model
- `firstName`, `middleName`, `lastName`: Child's name
- `dateOfBirth`: Child's birth date (critical for calculating vaccination schedules)
- `gender`: Male or Female
- `birthCertificateNo`: Optional birth certificate number
- `uniqueIdentifier`: System-generated unique ID
- `birthFacilityId`: Where the child was born (optional)

### 4. Vaccine Model
Stores information about all vaccines in the KEPI schedule.

```prisma
model Vaccine {
  id                   String   @id @default(cuid())
  code                 String   @unique  // e.g., "BCG", "OPV1", "PENTA1"
  name                 String
  description          String?
  administrationRoute  String?  // e.g., "Intramuscular", "Oral"
  administrationSite   String?  // e.g., "Left upper arm"
  dosage               String?  // e.g., "0.5ml", "2 drops"
  dosesRequired        String?  // e.g., "First of 3 doses"
  sideEffects          String?
  manufacturer         String?
  contraindications    String?
  vaccineType          String?  // e.g., "Live attenuated", "Recombinant"
  storageRequirements  String?
  diseasePrevented     String?
  recommendedAgeDays   Int      // Age in days when vaccine should be given
  minAgeDays           Int?
  maxAgeDays           Int?
  isBirthDose          Boolean  @default(false)
  isBooster            Boolean  @default(false)
  isActive             Boolean  @default(true)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}
```

### 5. Immunization Model
Records each vaccination event.

```prisma
model Immunization {
  id               String             @id @default(cuid())
  childId          String
  vaccineId        String
  facilityId       String
  healthWorkerId   String
  administeredBy   String?
  dateAdministered DateTime           @default(now())
  ageAtDays        Int
  status           ImmunizationStatus @default(ADMINISTERED)
  batchNumber      String?
  expirationDate   DateTime?
  notes            String?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt
  child            Child              @relation(fields: [childId], references: [id])
  facility         HealthFacility     @relation(fields: [facilityId], references: [id])
  healthWorker     HealthWorker       @relation(fields: [healthWorkerId], references: [id])
  vaccine          Vaccine            @relation(fields: [vaccineId], references: [id])
}
```

### 6. VaccinationSchedule Model
Tracks planned vs actual vaccinations.

```prisma
model VaccinationSchedule {
  id        String             @id @default(cuid())
  childId   String
  vaccineId String
  dueDate   DateTime
  status    ImmunizationStatus @default(SCHEDULED)
  createdAt DateTime           @default(now())
  updatedAt DateTime           @updatedAt
  child     Child              @relation(fields: [childId], references: [id])
  vaccine   Vaccine            @relation(fields: [vaccineId], references: [id])
}
```

### 7. HealthFacility Model
Represents healthcare facilities.

```prisma
model HealthFacility {
  id            String             @id @default(cuid())
  name          String
  type          HealthFacilityType
  code          String             @unique
  mflCode       String?            @unique  // MFL = Master Facility List
  county        String
  subCounty     String
  ward          String?
  address       String?
  phone         String?
  email         String?
  isActive      Boolean            @default(true)
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt
  children      Child[]
  healthWorkers HealthWorker[]
  immunizations Immunization[]
}
```

### 8. HealthWorker Model
Links to User and stores health worker-specific information.

```prisma
model HealthWorker {
  id             String          @id @default(cuid())
  userId         String          @unique
  licenseNumber  String?         @unique
  qualification  String?
  specialization String?
  facilityId     String?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  facility       HealthFacility? @relation(fields: [facilityId], references: [id])
  user           User            @relation(fields: [userId], references: [id])
  immunizations  Immunization[]
}
```

### 9. Reminder Model
Stores vaccination reminders.

```prisma
model Reminder {
  id           String         @id @default(cuid())
  childId      String
  parentId     String
  vaccineId    String
  type         ReminderType
  message      String
  scheduledFor DateTime
  status       ReminderStatus @default(PENDING)
  metadata     String?        @default("{}")
  retryCount   Int            @default(0)
  batchNumber  String?
  errorMessage String?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  child        Child          @relation(fields: [childId], references: [id])
  parent       Parent         @relation(fields: [parentId], references: [id])
  vaccine      Vaccine        @relation(fields: [vaccineId], references: [id])
}
```

### 10. GrowthRecord Model
Tracks children's growth metrics.

```prisma
model GrowthRecord {
  id              String   @id @default(cuid())
  childId         String
  measurementDate DateTime @default(now())
  weight          Float    // in kilograms
  height          Float?   // in centimeters
  recordedById    String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  child           Child    @relation(fields: [childId], references: [id])
  recordedBy      User     @relation(fields: [recordedById], references: [id])
}
```

### 11. DevelopmentRecord Model
Tracks child development milestones.

```prisma
model DevelopmentRecord {
  id             String   @id @default(cuid())
  childId        String
  assessmentDate DateTime @default(now())
  motorSkills    String?
  languageSkills String?
  socialSkills   String?
  recordedById   String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  child          Child    @relation(fields: [childId], references: [id])
  recordedBy     User     @relation(fields: [recordedById], references: [id])
}
```

### 12. Report Model
Stores generated reports.

```prisma
model Report {
  id            String         @id @default(cuid())
  title         String
  type          ReportType
  description   String?
  parameters    String         @default("{}")
  data          String         @default("{}")
  format        ReportFormat   @default(PDF)
  frequency     ReportFrequency @default(ON_DEMAND)
  isPublic      Boolean        @default(false)
  scheduledFor  DateTime?
  generatedById String
  generatedAt   DateTime       @default(now())
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  generatedBy   User           @relation(fields: [generatedById], references: [id])
}
```

### 13. Notification Model
Stores user notifications.

```prisma
model Notification {
  id        String           @id @default(cuid())
  userId    String
  type      NotificationType
  title     String
  message   String
  data      String?          @default("{}")
  isRead    Boolean          @default(false)
  createdAt DateTime         @default(now())
  user      User             @relation(fields: [userId], references: [id])
}
```

### 14. Supporting Models
- **Otp**: One-time passwords for verification
- **Session**: Active user sessions
- **UserProfile**: Extended user profile information
- **AdminProfile**: Admin-specific profile data
- **AuditLog**: System audit trail

---

## Core Modules

The backend consists of 16 main modules, each handling a specific domain:

### 1. Auth Module (`/auth`)
**Purpose:** Handles authentication and authorization

**Key Files:**
- `auth.service.ts`: Core authentication logic
- `auth.controller.ts`: REST endpoints
- `strategies/jwt.strategy.ts`: JWT validation strategy
- `guards/jwt-auth.guard.ts`: JWT authentication guard
- `guards/roles.guard.ts`: Role-based access control

**Functionality:**
- User registration
- User login (email/password)
- JWT token generation and validation
- Password change/reset
- OTP verification for email/phone

### 2. Users Module (`/users`)
**Purpose:** Manages user accounts

**Key Files:**
- `users.service.ts`: User management logic
- `users.controller.ts`: REST endpoints
- `users.repository.ts`: Database operations

**Functionality:**
- Create, read, update, delete users
- Query users with filters
- Change password
- User profile management

### 3. Parents Module (`/parents`)
**Purpose:** Manages parent profiles

**Key Files:**
- `parents.service.ts`: Parent management logic
- `parents.controller.ts`: REST endpoints

**Functionality:**
- Create parent profile
- Link children to parents
- Get parent dashboard data
- Manage parent emergency contacts

### 4. Children Module (`/children`)
**Purpose:** Manages child records

**Key Files:**
- `children.service.ts`: Child management logic
- `children.controller.ts`: REST endpoints
- `children.repository.ts`: Database operations
- `vaccine-scheduler.service.ts`: Vaccination schedule generation

**Functionality:**
- Register new children
- Update child information
- Get child details
- Search children
- Auto-generate vaccination schedules upon registration
- Growth record management

### 5. Vaccines Module (`/vaccines`)
**Purpose:** Manages vaccine catalog

**Key Files:**
- `vaccines.service.ts`: Vaccine management logic
- `vaccines.controller.ts`: REST endpoints
- `keni-schedule.service.ts`: KEPI schedule definitions

**Functionality:**
- CRUD operations for vaccines
- KEPI schedule management
- Vaccine seeding (initial data population)

### 6. Immunizations Module (`/immunizations`)
**Purpose:** Records vaccination events

**Key Files:**
- `immunizations.service.ts`: Immunization logic
- `immunizations.controller.ts`: REST endpoints

**Functionality:**
- Record vaccinations
- Update immunization status
- Get immunization history
- Track vaccine batch information

### 7. Schedules Module (`/schedules`)
**Purpose:** Manages vaccination schedules

**Key Files:**
- `schedules.service.ts`: Schedule management logic
- `schedules.controller.ts`: REST endpoints
- `schedule-calculator.service.ts`: Schedule calculation

**Functionality:**
- Generate vaccination schedules
- Get upcoming vaccines
- Calculate due dates based on child's DOB
- Track schedule status

### 8. Reminders Module (`/reminders`)
**Purpose:** Manages vaccination reminders

**Key Files:**
- `reminders.service.ts`: Reminder logic
- `reminders.controller.ts`: REST endpoints
- `reminder-engine.service.ts`: Reminder processing engine

**Functionality:**
- Create reminders for upcoming vaccinations
- Process pending reminders
- Retry failed reminders
- Track reminder delivery status

### 9. Notifications Module (`/notifications`)
**Purpose:** Multi-channel notification delivery

**Key Files:**
- `notifications.service.ts`: Notification logic
- `notifications.controller.ts`: REST endpoints
- `notification-queue.service.ts`: Queue management
- `providers/email.provider.ts`: Email delivery
- `providers/sms.provider.ts`: SMS delivery
- `providers/push.provider.ts`: Push notifications

**Functionality:**
- Send email notifications
- Send SMS notifications
- Send push notifications
- Queue and retry failed notifications
- Template-based notifications

### 10. Reports Module (`/reports`)
**Purpose:** Generate various reports

**Key Files:**
- `reports.service.ts`: Report generation logic
- `reports.controller.ts`: REST endpoints
- `report-generator.service.ts`: Report generation engine
- `templates/coverage-report.template.ts`: Coverage report template
- `templates/facility-report.template.ts`: Facility report template

**Functionality:**
- Generate immunization coverage reports
- Generate facility statistics reports
- Generate missed vaccines reports
- Export reports in various formats

### 11. Analytics Module (`/analytics`)
**Purpose:** Data analysis and predictions

**Key Files:**
- `analytics.service.ts`: Analytics logic
- `analytics.controller.ts`: REST endpoints
- `data-mining.service.ts`: Data mining operations
- `models/prediction.model.ts`: Prediction models

**Functionality:**
- Calculate immunization coverage rates
- Predict missed vaccinations
- Generate county-level statistics
- Dashboard data for county admins

### 12. Facilities Module (`/facilities`)
**Purpose:** Manages health facilities

**Key Files:**
- `facilities.service.ts`: Facility management
- `facilities.controller.ts`: REST endpoints
- `facilities.repository.ts`: Database operations

**Functionality:**
- CRUD operations for facilities
- Search facilities by county/sub-county
- Manage facility status (active/inactive)

### 13. Mailer Module (`/mailer`)
**Purpose:** Email sending

**Key Files:**
- `mailer.service.ts`: Email sending logic
- `mailer.controller.ts`: REST endpoints

**Functionality:**
- Send transactional emails
- Email template management
- Email queue processing

### 14. OTP Module (`/otp`)
**Purpose:** One-time password management

**Key Files:**
- `otp.service.ts`: OTP logic
- `otp.controller.ts`: REST endpoints

**Functionality:**
- Generate OTPs
- Verify OTPs
- OTP expiration management

### 15. Prisma Module (`/prisma`)
**Purpose:** Database connection management

**Key Files:**
- `prisma.service.ts`: Prisma client management
- `prisma.module.ts`: Prisma module definition

**Functionality:**
- Database connection management
- Transaction support
- Query logging (development)

### 16. App Module (`/app`)
**Purpose:** Root application module

**Key Files:**
- `app.module.ts`: Root module
- `main.ts`: Application entry point

**Functionality:**
- Module orchestration
- Global middleware configuration
- CORS configuration

---

## Authentication & Authorization

### Authentication Flow

The system uses JWT (JSON Web Token) for authentication:

1. **User Registration:**
   - User submits email, password, full name, phone number (optional)
   - System validates data, hashes password using bcrypt
   - Creates user record in database
   - Returns access token

2. **User Login:**
   - User submits email and password
   - System validates credentials
   - Generates JWT access token (15-minute expiry)
   - Returns token to client

3. **Token Validation:**
   - Each protected request includes JWT in Authorization header
   - JWT Strategy validates token signature and expiration
   - Extracts user ID and role from token
   - Makes user available in request object

### Authorization (RBAC)

The system implements Role-Based Access Control (RBAC):

| Role | Permissions |
|------|-------------|
| **PARENT** | Register children, view own children, record immunizations (via health worker), view reminders |
| **HEALTH_WORKER** | All PARENT permissions + record immunizations, manage children at their facility, view facility reports |
| **ADMIN** | Manage users, manage facilities, view all reports, manage vaccines |
| **SUPER_ADMIN** | All permissions + system configuration, manage admins |

### Guards

- **JwtAuthGuard**: Validates JWT token on protected routes
- **RolesGuard**: Checks user role against allowed roles for endpoint

### Decorators

- **@Roles('ROLE_NAME')**: Specifies required role for endpoint
- **@CurrentUser()**: Extracts current user from request

---

## User Roles

### PARENT
- Default role for new registrations
- Can register children under their account
- Can view their children's immunization records
- Receives reminders for upcoming vaccinations
- Can update their profile

### HEALTH_WORKER
- Typically assigned by administrators
- Can record immunizations at their facility
- Can view children registered at their facility
- Can access facility-level reports
- Can update child information

### ADMIN
- Manages health workers and facilities
- Can access all data within their jurisdiction
- Can generate reports
- Can manage vaccine catalog
- Typically county-level administrators

### SUPER_ADMIN
- System-wide access
- Can create other admins
- Can modify system configuration
- Access to all features

---

## Key Workflows

### 1. Child Registration Flow

```
1. Parent logs in (receives JWT)
2. Parent submits child registration form:
   - Child's first name, middle name, last name
   - Date of birth
   - Gender
   - Birth certificate number (optional)
   - Birth facility (optional)
3. System:
   - Validates input
   - Creates Parent profile if not exists
   - Creates Child record
   - Auto-generates vaccination schedule based on DOB
   - Creates reminders for each scheduled vaccine
4. Returns created child with full schedule
```

### 2. Immunization Recording Flow

```
1. Health worker logs in
2. Health worker searches for child (by name, ID, or birth certificate)
3. Health worker selects vaccine to administer
4. System:
   - Validates child exists and vaccine is due
   - Creates Immunization record
   - Updates VaccinationSchedule status
   - Marks reminder as completed
5. Returns immunization record
```

### 3. Reminder Processing Flow

```
1. Reminder engine runs on schedule (e.g., every hour)
2. For each pending reminder:
   - Check if reminder time has passed
   - Send notification via appropriate channel (email/SMS/push)
   - On success: mark reminder as SENT
   - On failure: increment retry count
   - If max retries exceeded: mark as FAILED
3. Log results for monitoring
```

### 4. Report Generation Flow

```
1. Admin requests report (e.g., coverage report)
2. System:
   - Validates report parameters
   - Queries database for required data
   - Processes data according to report template
   - Generates report (PDF/JSON/CSV)
3. Returns report to user
4. Stores report in database
```

---

## API Endpoints Overview

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login user | No |
| POST | `/api/auth/refresh` | Refresh access token | Yes |
| POST | `/api/auth/change-password` | Change password | Yes |
| POST | `/api/auth/forgot-password` | Request password reset | No |
| POST | `/api/auth/reset-password` | Reset password with token | No |

### User Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/users` | List users (paginated) | Yes (Admin) |
| GET | `/api/users/:id` | Get user by ID | Yes |
| PATCH | `/api/users/:id` | Update user | Yes |
| DELETE | `/api/users/:id` | Delete user | Yes (Admin) |

### Parent Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/parents/me` | Get current parent's profile | Yes |
| GET | `/api/parents/:id` | Get parent by ID | Yes |
| GET | `/api/parents/:id/dashboard` | Get parent dashboard data | Yes |
| PATCH | `/api/parents/:id` | Update parent profile | Yes |

### Child Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/children` | Register new child | Yes |
| GET | `/api/children` | List children (paginated) | Yes |
| GET | `/api/children/:id` | Get child by ID | Yes |
| GET | `/api/children/parent/:parentId` | Get children by parent | Yes |
| PATCH | `/api/children/:id` | Update child | Yes |
| DELETE | `/api/children/:id` | Delete child | Yes |

### Vaccine Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/vaccines` | List all vaccines | Yes |
| GET | `/api/vaccines/:id` | Get vaccine by ID | Yes |
| POST | `/api/vaccines` | Create vaccine | Yes (Admin) |
| PATCH | `/api/vaccines/:id` | Update vaccine | Yes (Admin) |
| DELETE | `/api/vaccines/:id` | Delete vaccine | Yes (Admin) |

### Immunization Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/immunizations` | Record immunization | Yes |
| GET | `/api/immunizations` | List immunizations | Yes |
| GET | `/api/immunizations/:id` | Get immunization by ID | Yes |
| GET | `/api/immunizations/child/:childId` | Get immunizations for child | Yes |
| PATCH | `/api/immunizations/:id` | Update immunization | Yes |

### Schedule Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/schedules` | List schedules | Yes |
| GET | `/api/schedules/child/:childId` | Get schedule for child | Yes |
| GET | `/api/schedules/upcoming` | Get upcoming vaccines | Yes |
| POST | `/api/schedules/generate` | Generate schedule for child | Yes |

### Reminder Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/reminders` | List reminders | Yes |
| GET | `/api/reminders/:id` | Get reminder by ID | Yes |
| GET | `/api/reminders/child/:childId` | Get reminders for child | Yes |
| PATCH | `/api/reminders/:id` | Update reminder | Yes |

### Report Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/reports/generate` | Generate report | Yes |
| GET | `/api/reports` | List generated reports | Yes |
| GET | `/api/reports/:id` | Get report by ID | Yes |
| GET | `/api/reports/:id/download` | Download report file | Yes |

### Analytics Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/analytics/coverage` | Get coverage analytics | Yes |
| GET | `/api/analytics/missed` | Get missed vaccines | Yes |
| GET | `/api/analytics/dashboard` | Get dashboard data | Yes |
| GET | `/api/analytics/predictions` | Get predictions | Yes |

### Facility Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/facilities` | List facilities | Yes |
| GET | `/api/facilities/:id` | Get facility by ID | Yes |
| POST | `/api/facilities` | Create facility | Yes (Admin) |
| PATCH | `/api/facilities/:id` | Update facility | Yes (Admin) |

### Notification Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/notifications` | List notifications | Yes |
| GET | `/api/notifications/unread` | Get unread notifications | Yes |
| PATCH | `/api/notifications/:id/read` | Mark as read | Yes |
| POST | `/api/notifications/send` | Send notification | Yes |

---

## KEPI Schedule Reference

The Kenya Expanded Programme on Immunization (KEPI) schedule defines when each vaccine should be administered:

### Birth Dose (Day 0)

| Vaccine | Code | Disease Prevented | Route |
|---------|------|-------------------|-------|
| Bacillus Calmette-Guérin | BCG | Tuberculosis | Intradermal (left arm) |
| Oral Polio Vaccine 0 | OPV0 | Polio | Oral (2 drops) |
| Hepatitis B Birth Dose | HEPB0 | Hepatitis B | Intramuscular |

### 6 Weeks (42 days)

| Vaccine | Code | Disease Prevented | Route |
|---------|------|-------------------|-------|
| Oral Polio Vaccine 1 | OPV1 | Polio | Oral |
| Pentavalent 1 | PENTA1 | DPT+HepB+Hib | Intramuscular |
| Pneumococcal Conjugate Vaccine 1 | PCV1 | Pneumonia | Intramuscular |
| Rotavirus Vaccine 1 | RV1 | Rotavirus | Oral |
| Inactivated Polio Vaccine 1 | IPV1 | Polio | Intramuscular |

### 10 Weeks (70 days)

| Vaccine | Code | Disease Prevented | Route |
|---------|------|-------------------|-------|
| Pentavalent 2 | PENTA2 | DPT+HepB+Hib | Intramuscular |
| PCV2 | PCV2 | Pneumonia | Intramuscular |
| RV2 | RV2 | Rotavirus | Oral |

### 14 Weeks (98 days)

| Vaccine | Code | Disease Prevented | Route |
|---------|------|-------------------|-------|
| Pentavalent 3 | PENTA3 | DPT+HepB+Hib | Intramuscular |
| OPV3 | OPV3 | Polio | Oral |
| PCV3 | PCV3 | Pneumonia | Intramuscular |
| IPV2 | IPV2 | Polio | Intramuscular |

### 6 Months (180 days)

| Vaccine | Code | Disease Prevented | Route |
|---------|------|-------------------|-------|
| Vitamin A | VIT-A | Vitamin A deficiency | Oral |
| Measles-Rubella 1 | MR1 | Measles + Rubella | Subcutaneous |

### 9 Months (270 days)

| Vaccine | Code | Disease Prevented | Route |
|---------|------|-------------------|-------|
| Measles-Rubella 1 | MR1 | Measles + Rubella | Subcutaneous |
| Yellow Fever | YF | Yellow Fever | Subcutaneous |

### 12 Months (365 days)

| Vaccine | Code | Disease Prevented | Route |
|---------|------|-------------------|-------|
| Vitamin A | VIT-A | Vitamin A deficiency | Oral |

### 18 Months (540 days)

| Vaccine | Code | Disease Prevented | Route |
|---------|------|-------------------|-------|
| Measles-Rubella 2 | MR2 | Measles + Rubella | Subcutaneous |
| Vitamin A | VIT-A | Vitamin A deficiency | Oral |

---

## System Flow Examples

### Example 1: Parent Registering a Newborn

**Scenario:** A mother (Sarah) just gave birth at Nairobi West Hospital and wants to register her baby in the system.

**Steps:**

1. **Sarah logs in:**
   ```
   POST /api/auth/login
   Body: { "email": "sarah@email.com", "password": "secure123" }
   Response: { "accessToken": "eyJhbGciOiJIUzI1NiIs...", "user": {...} }
   ```

2. **Sarah registers her baby:**
   ```
   POST /api/children
   Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..." }
   Body: {
     "firstName": "Emmanuel",
     "lastName": "Ochieng",
     "dateOfBirth": "2024-01-15",
     "gender": "MALE",
     "birthFacilityName": "Nairobi West Hospital"
   }
   ```

3. **System creates child and generates schedule:**
   - Creates Child record with unique ID
   - Creates Parent profile if not exists
   - Generates vaccination schedule starting from birth date
   - Creates reminders for each vaccine
   - Returns child with full schedule

4. **Sarah views her dashboard:**
   ```
   GET /api/parents/me/dashboard
   Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..." }
   Response: {
     "children": [...],
     "upcomingVaccines": [...],
     "reminders": [...]
   }
   ```

### Example 2: Health Worker Recording Vaccination

**Scenario:** A health worker at Nairobi West Hospital needs to record that they administered BCG and OPV0 to Emmanuel.

**Steps:**

1. **Health worker logs in:**
   ```
   POST /api/auth/login
   Body: { "email": "nurse@hospital.com", "password": "nurse123" }
   Response: { "accessToken": "...", "user": { "role": "HEALTH_WORKER" } }
   ```

2. **Health worker finds the child:**
   ```
   GET /api/children?search=Emmanuel
   Headers: { "Authorization": "Bearer ..." }
   Response: { "data": [{ "id": "child_123", "firstName": "Emmanuel", ... }] }
   ```

3. **Health worker records immunization:**
   ```
   POST /api/immunizations
   Headers: { "Authorization": "Bearer ..." }
   Body: {
     "childId": "child_123",
     "vaccineCode": "BCG",
     "facilityId": "facility_456",
     "dateAdministered": "2024-01-15",
     "batchNumber": "BCG2024001"
   }
   ```

4. **System updates records:**
   - Creates Immunization record
   - Updates VaccinationSchedule status to ADMINISTERED
   - Marks related reminder as completed

### Example 3: Generating Coverage Report

**Scenario:** A county administrator wants to generate an immunization coverage report for their county.

**Steps:**

1. **Admin logs in:**
   ```
   POST /api/auth/login
   Body: { "email": "admin@county.go.ke", "password": "admin123" }
   Response: { "accessToken": "...", "user": { "role": "ADMIN" } }
   ```

2. **Admin requests report:**
   ```
   POST /api/reports/generate
   Headers: { "Authorization": "Bearer ..." }
   Body: {
     "type": "COVERAGE",
     "parameters": {
       "county": "Nairobi",
       "startDate": "2024-01-01",
       "endDate": "2024-03-31"
     },
     "format": "PDF"
   }
   ```

3. **System generates report:**
   - Queries all children born in date range
   - Checks immunization records for each
   - Calculates coverage percentages
   - Generates PDF document
   - Returns report with download URL

---

## Summary

Kinga Yetu Digital is a comprehensive child health tracking system built with modern technologies. It provides:

1. **Complete Child Health Tracking**: From birth through childhood vaccinations
2. **Automated Scheduling**: KEPI-based vaccination schedules generated automatically
3. **Multi-channel Notifications**: Email, SMS, and push notifications for reminders
4. **Role-based Access**: Secure access control for different user types
5. **Comprehensive Reporting**: Coverage reports, missed vaccines, facility statistics
6. **Analytics**: Data-driven insights for public health decision-making

The system is designed to be scalable, secure, and user-friendly, supporting Kenya's goal of improving child health outcomes through better immunization tracking.
