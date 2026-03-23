# Kinga Yetu Digital - Backend System Explanation

## Table of Contents
1. [Introduction](#introduction)
2. [System Overview](#system-overview)
3. [Technology Stack](#technology-stack)
4. [Database Schema](#database-schema)
5. [Core Modules](#core-modules)
6. [Authentication & Authorization](#authentication--authorization)
7. [User Roles](#user-roles)
8. [Key Workflows](#key-workflows)
9. [API Endpoints Overview](#api-endpoints-overview)
10. [System Flow Examples](#system-flow-examples)

---

## Introduction

**Kinga Yetu Digital** (Swahili for "Our Children") is a comprehensive child health and immunization tracking system designed for Kenya's healthcare infrastructure. The system helps track children's vaccination schedules, manage health facility records, send reminders to parents, and generate analytics for public health officials.

This document explains how the backend works as if you're completely new to the system.

---

## System Overview

The backend is a RESTful API that serves as the central nervous system for the entire application. It handles:

1. **User Management** - Authentication, registration, and role-based access
2. **Child Registration & Tracking** - Managing children's health records
3. **Vaccination Scheduling** - Following Kenya's KEPI (Kenya Expanded Programme on Immunization) schedule
4. **Immunization Recording** - Recording when vaccines are administered
5. **Reminder System** - Sending notifications to parents about upcoming vaccinations
6. **Health Facility Management** - Managing healthcare facilities and workers
7. **Reports & Analytics** - Generating coverage reports and predictive analytics
8. **Notifications** - Multi-channel notifications (Email, SMS, Push)

---

## Technology Stack

### Framework & Runtime
- **NestJS** - A progressive Node.js framework for building efficient, reliable, and scalable server-side applications
- **TypeScript** - Type-safe JavaScript
- **Node.js** - JavaScript runtime

### Database & ORM
- **PostgreSQL** - Relational database
- **Prisma** - Modern ORM for type-safe database access

### Authentication & Security
- **JWT (JSON Web Tokens)** - Stateless authentication
- **bcrypt** - Password hashing
- **Passport.js** - Authentication middleware

### Additional Libraries
- **Nodemailer** - Email sending
- **OTP Generator** - One-time password generation
- **Moment.js** - Date/time handling
- **NestJS Schedule** - Cron job scheduling

---

## Database Schema

The database is the foundation of the system. Here's a breakdown of the main entities:

### User
The central entity that represents all system users.
```typescript
model User {
  id              String    // Unique identifier (cuid)
  email           String    // Unique email address
  phoneNumber     String?   // Optional phone number
  password        String    // Hashed password
  fullName        String    // User's full name
  role            UserRole  // PARENT, HEALTH_WORKER, ADMIN, SUPER_ADMIN
  isActive        Boolean   // Account status
  isEmailVerified Boolean   // Email verification status
  isPhoneVerified Boolean   // Phone verification status
  lastLoginAt     DateTime? // Last login timestamp
  createdAt       DateTime  // Account creation date
  updatedAt       DateTime  // Last update date
}
```

### Parent
Extends User for parents who manage children's records.
```typescript
model Parent {
  id               String   // Unique identifier
  userId           String   // Links to User
  emergencyContact String?  // Emergency contact name
  emergencyPhone   String?  // Emergency phone number
  children         Child[]  // One-to-many relationship with children
}
```

### Child
Represents a child being tracked in the system.
```typescript
model Child {
  id                  String   // Unique identifier
  parentId            String   // Links to Parent
  firstName           String   // Child's first name
  middleName          String?  // Optional middle name
  lastName            String   // Child's last name
  dateOfBirth         DateTime // Birth date (critical for scheduling)
  gender              Gender   // MALE or FEMALE
  birthCertificateNo String?  // Optional birth certificate
  uniqueIdentifier   String   // System-generated unique ID
  birthFacilityId    String?  // Where child was born
  immunizations      Immunization[] // Vaccination records
  schedules          VaccinationSchedule[] // Upcoming vaccines
  growthRecords      GrowthRecord[] // Growth tracking
}
```

### Vaccine
Contains information about each vaccine in the KEPI schedule.
```typescript
model Vaccine {
  id                   String   // Unique identifier
  code                 String   // Short code (e.g., "BCG", "OPV1")
  name                 String   // Full name
  recommendedAgeDays   Int      // When to administer (in days from birth)
  minAgeDays           Int?     // Earliest allowed age
  maxAgeDays           Int?     // Latest allowed age
  isBirthDose          Boolean  // Is this given at birth?
  isBooster            Boolean  // Is this a booster shot?
  dosesRequired        String?  // How many doses needed
  diseasePrevented     String?  // Disease this prevents
  // ... many more fields
}
```

### Immunization
Records when a vaccine was actually administered.
```typescript
model Immunization {
  id               String             // Unique identifier
  childId          String             // Links to Child
  vaccineId        String             // Links to Vaccine
  facilityId       String             // Where administered
  healthWorkerId   String             // Who administered
  dateAdministered DateTime           // When administered
  ageAtDays        Int                // Child's age in days
  status           ImmunizationStatus // ADMINISTERED, etc.
  batchNumber      String?            // Vaccine batch
}
```

### VaccinationSchedule
Tracks upcoming vaccinations for each child.
```typescript
model VaccinationSchedule {
  id        String             // Unique identifier
  childId   String             // Links to Child
  vaccineId String             // Links to Vaccine
  dueDate   DateTime           // When vaccine is due
  status    ImmunizationStatus // SCHEDULED, ADMINISTERED, MISSED, etc.
}
```

### Reminder
Notifications sent to parents about upcoming vaccinations.
```typescript
model Reminder {
  id           String         // Unique identifier
  childId      String         // Links to Child
  parentId     String         // Links to Parent
  vaccineId    String         // Links to Vaccine
  type         ReminderType   // VACCINE_DUE, VACCINE_OVERDUE, etc.
  message      String         // Reminder message
  scheduledFor DateTime       // When to send
  status       ReminderStatus // PENDING, SENT, FAILED, etc.
}
```

### HealthFacility
Healthcare facilities in the system.
```typescript
model HealthFacility {
  id        String             // Unique identifier
  name      String             // Facility name
  type      HealthFacilityType // HOSPITAL, HEALTH_CENTER, etc.
  code      String             // Unique code
  mflCode   String?            // MFL (Master Facility List) code
  county    String             // Location: County
  subCounty String             // Location: Sub-county
  ward      String?            // Location: Ward
  phone     String?            // Contact phone
  email     String?            // Contact email
}
```

### HealthWorker
Staff at healthcare facilities.
```typescript
model HealthWorker {
  id             String   // Unique identifier
  userId         String   // Links to User
  licenseNumber  String?  // Professional license
  qualification  String?  // Medical qualification
  specialization String?  // Area of specialization
  facilityId     String?  // Where they work
}
```

---

## Core Modules

The backend is organized into **16 main modules**, each handling a specific domain:

### 1. Auth Module (`/auth`)
Handles all authentication-related functionality:
- **User Registration** - Creates new user accounts
- **Login** - Validates credentials and issues JWT tokens
- **Password Management** - Change password, reset password
- **Email Verification** - OTP-based email verification
- **Logout** - Invalidates sessions

### 2. Users Module (`/users`)
Manages user accounts:
- CRUD operations for users
- User profile management
- User search and filtering
- Role-based user queries

### 3. Parents Module (`/parents`)
Parent-specific functionality:
- Parent profile management
- Linking/unlinking children
- Parent dashboard data
- Emergency contact management

### 4. Children Module (`/children`)
Child registration and management:
- Register new children
- Update child information
- View child details with immunization history
- Growth record tracking
- Development milestone tracking

### 5. Vaccines Module (`/vaccines`)
Vaccine catalog management:
- KEPI schedule seed data
- Vaccine CRUD operations
- Vaccine search and filtering
- Vaccine statistics

### 6. Immunizations Module (`/immunizations`)
Recording vaccine administration:
- Record new immunizations
- Update immunization records
- View immunization history
- Track immunization status

### 7. Schedules Module (`/schedules`)
Vaccination schedule management:
- Generate schedules based on child's birth date
- Calculate due dates using KEPI schedule
- Track upcoming vaccinations
- Regenerate missed schedules

### 8. Reminders Module (`/reminders`)
Reminder management:
- Create manual reminders
- Generate automatic reminders
- Track reminder status
- Bulk reminder operations

### 9. Reports Module (`/reports`)
Report generation:
- Coverage reports
- Facility statistics
- Missed vaccines reports
- Custom report generation

### 10. Notifications Module (`/notifications`)
Multi-channel notifications:
- Email notifications
- SMS notifications
- Push notifications
- Notification queue management

### 11. Analytics Module (`/analytics`)
Data analysis and predictions:
- Immunization trends
- Coverage analysis
- Outbreak risk prediction
- Performance metrics

### 12. Facilities Module (`/facilities`)
Health facility management:
- CRUD operations for facilities
- Search by county/sub-county
- MFL code management

### 13. Mailer Module (`/mailer`)
Email sending:
- SMTP configuration
- Template-based emails
- OTP emails
- Report delivery

### 14. OTP Module (`/otp`)
One-time password handling:
- Generate OTPs
- Validate OTPs
- OTP expiration management

### 15. Prisma Module (`/prisma`)
Database connection:
- Prisma service singleton
- Database transaction support

---

## Authentication & Authorization

### How Authentication Works

1. **Registration**
   - User submits email, password, full name, and role
   - System hashes password using bcrypt (10 rounds)
   - Creates User record and role-specific profile (Parent, HealthWorker, or Admin)
   - Generates OTP for email verification
   - Sends verification email
   - Returns JWT access token

2. **Login**
   - User submits email and password
   - System verifies:
     - User exists
     - Account is active
     - Email is verified
     - Password matches (bcrypt comparison)
   - On success: Returns JWT access token with user data
   - On failure: Returns 401 Unauthorized

3. **JWT Token**
   - Contains: user ID (sub), email, role
   - Expiry: 15 minutes (configurable)
   - Sent in Authorization header: `Bearer <token>`

### How Authorization Works

The system uses **Role-Based Access Control (RBAC)**:

1. **JWT Auth Guard** - Verifies valid JWT token
2. **Roles Guard** - Checks if user's role matches required role
3. **Roles Decorator** - Specifies required roles on endpoints

Example:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN)
@Post('immunizations')
async recordImmunization(...) { }
```

---

## User Roles

The system supports **4 user roles**:

### 1. PARENT
- Register children
- View own children's records
- Receive vaccination reminders
- Update own profile

### 2. HEALTH_WORKER
- Record immunizations
- Register children at their facility
- View facility statistics
- Manage vaccination schedules

### 3. ADMIN
- Manage users
- Manage facilities
- Generate reports
- View system analytics

### 4. SUPER_ADMIN
- All admin privileges
- System configuration
- Manage other admins

---

## Key Workflows

### Workflow 1: Parent Registers a Child

```
1. Parent logs in (receives JWT token)
2. Parent calls POST /api/children with:
   - firstName, lastName, dateOfBirth, gender
3. Backend:
   a. Finds Parent profile from JWT user ID
   b. Creates Child record linked to Parent
   c. Calculates vaccination schedule based on dateOfBirth
   d. Creates VaccinationSchedule records for each KEPI vaccine
   e. Returns child data with schedules
4. Frontend displays upcoming vaccinations
```

### Workflow 2: Health Worker Records Immunization

```
1. Health Worker logs in
2. Health Worker calls POST /api/immunizations with:
   - childId, vaccineId, facilityId, dateAdministered
3. Backend:
   a. Validates child exists
   b. Validates vaccine exists
   c. Validates facility exists
   d. Creates Immunization record
   e. Updates VaccinationSchedule status to ADMINISTERED
   f. Returns immunization record
4. Parent receives notification (if enabled)
```

### Workflow 3: Automatic Reminder Generation

```
1. Reminder Engine runs on schedule (cron job)
2. For each upcoming vaccination (due within 7 days):
   a. Check if reminder already sent
   b. Create Reminder record
   c. Queue notification (Email/SMS/Push)
3. Notification Service processes queue:
   a. Send via appropriate provider
   b. Update reminder status to SENT
4. Parent receives reminder
```

### Workflow 4: Parent Views Dashboard

```
1. Parent logs in
2. Parent calls GET /api/parents/:id/dashboard
3. Backend:
   a. Fetches parent profile
   b. Fetches all children with:
      - Immunization history
      - Upcoming schedules
      - Growth records
   c. Calculates statistics:
      - Total children
      - Fully immunized children
      - Upcoming vaccinations
      - Overdue vaccinations
   d. Returns dashboard object with children and stats
4. Frontend displays dashboard
```

---

## API Endpoints Overview

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login user |
| POST | /api/auth/logout | Logout user |
| POST | /api/auth/verify-email | Verify email with OTP |
| POST | /api/auth/change-password | Change password |
| POST | /api/auth/reset-password | Request password reset |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/users | List users (paginated) |
| GET | /api/users/:id | Get user by ID |
| PATCH | /api/users/:id | Update user |
| DELETE | /api/users/:id | Delete user |

### Parents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/parents | List parents |
| GET | /api/parents/:id | Get parent profile |
| GET | /api/parents/:id/dashboard | Get parent dashboard |
| POST | /api/parents | Create parent profile |
| PATCH | /api/parents/:id | Update parent profile |
| POST | /api/parents/:id/children | Link child to parent |
| DELETE | /api/parents/:id/children/:childId | Unlink child |

### Children
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/children | List children |
| GET | /api/children/my-children | Get parent's children |
| GET | /api/children/:id | Get child details |
| POST | /api/children | Register new child |
| PATCH | /api/children/:id | Update child |
| DELETE | /api/children/:id | Delete child |

### Vaccines
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/vaccines | List vaccines |
| GET | /api/vaccines/:id | Get vaccine details |
| POST | /api/vaccines | Create vaccine |
| PATCH | /api/vaccines/:id | Update vaccine |

### Immunizations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/immunizations | List immunizations |
| GET | /api/immunizations/:id | Get immunization |
| POST | /api/immunizations | Record immunization |
| PATCH | /api/immunizations/:id | Update immunization |

### Schedules
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/schedules | List schedules |
| GET | /api/schedules/child/:childId | Get child's schedules |
| POST | /api/schedules/generate | Generate schedule for child |
| POST | /api/schedules/regenerate | Regenerate missed schedules |

### Reminders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/reminders | List reminders |
| GET | /api/reminders/parent/:parentId | Get parent's reminders |
| POST | /api/reminders | Create reminder |
| POST | /api/reminders/generate | Generate bulk reminders |
| PATCH | /api/reminders/:id | Update reminder |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/reports | List reports |
| GET | /api/reports/:id | Get report |
| POST | /api/reports | Create report |
| GET | /api/reports/coverage | Generate coverage report |
| GET | /api/reports/facility-stats | Get facility statistics |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/analytics | Get analytics data |
| GET | /api/analytics/predictions | Get predictions |
| GET | /api/analytics/outbreak-risk | Get outbreak risk |
| GET | /api/analytics/dashboard | Get admin dashboard |

### Facilities
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/facilities | List facilities |
| GET | /api/facilities/:id | Get facility |
| GET | /api/facilities/county/:county | Get facilities by county |
| POST | /api/facilities | Create facility |
| PATCH | /api/facilities/:id | Update facility |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/notifications | List notifications |
| POST | /api/notifications | Send notification |
| PATCH | /api/notifications/:id/read | Mark as read |

---

## System Flow Examples

### Example 1: Complete Child Registration Flow

```
Scenario: A parent wants to register their newborn baby

1. Parent registers an account:
   POST /api/auth/register
   Body: { "email": "parent@example.com", "password": "secure123", 
           "fullName": "John Doe", "role": "PARENT" }
   Response: { "user": {...}, "accessToken": "eyJ...", 
               "message": "Please check your email for verification code" }

2. Parent verifies email:
   POST /api/auth/verify-email
   Body: { "email": "parent@example.com", "code": "123456" }
   Response: { "message": "Email verified successfully" }

3. Parent logs in:
   POST /api/auth/login
   Body: { "email": "parent@example.com", "password": "secure123" }
   Response: { "user": {...}, "accessToken": "eyJ..." }

4. Parent registers child:
   POST /api/children (with JWT in header)
   Body: { "firstName": "Baby", "lastName": "Doe", 
           "dateOfBirth": "2024-01-15", "gender": "MALE" }
   Response: { 
     "id": "child_123",
     "firstName": "Baby",
     "lastName": "Doe",
     "dateOfBirth": "2024-01-15",
     "schedules": [
       { "vaccineName": "BCG", "dueDate": "2024-01-15", "status": "SCHEDULED" },
       { "vaccineName": "OPV0", "dueDate": "2024-01-15", "status": "SCHEDULED" },
       { "vaccineName": "HEPB0", "dueDate": "2024-01-15", "status": "SCHEDULED" },
       { "vaccineName": "OPV1", "dueDate": "2024-02-26", "status": "SCHEDULED" },
       // ... more KEPI vaccines
     ]
   }

5. System automatically generates reminders for upcoming vaccines
```

### Example 2: Health Worker Records Vaccination

```
Scenario: A health worker records that a child received their BCG vaccine

1. Health worker logs in (with HEALTH_WORKER role)
2. Health worker finds the child:
   GET /api/children/child_123
   Response: { "id": "child_123", "firstName": "Baby", ... }

3. Health worker records immunization:
   POST /api/immunizations (with JWT in header)
   Body: { 
     "childId": "child_123",
     "vaccineId": "vaccine_bcg",
     "facilityId": "facility_001",
     "dateAdministered": "2024-01-15"
   }
   Response: {
     "id": "imm_001",
     "childId": "child_123",
     "vaccineId": "vaccine_bcg",
     "status": "ADMINISTERED",
     "dateAdministered": "2024-01-15"
   }

4. System updates schedule status to ADMINISTERED
5. Parent receives notification about the vaccination
```

### Example 3: Parent Views Dashboard

```
Scenario: A parent wants to see their children's vaccination status

1. Parent logs in
2. Parent requests dashboard:
   GET /api/parents/parent_123/dashboard (with JWT in header)
   Response: {
     "parent": { "id": "parent_123", "fullName": "John Doe", ... },
     "children": [
       {
         "id": "child_123",
         "firstName": "Baby",
         "lastName": "Doe",
         "dateOfBirth": "2024-01-15",
         "ageInMonths": 6,
         "immunizations": [
           { "vaccineName": "BCG", "dateAdministered": "2024-01-15", "status": "ADMINISTERED" },
           { "vaccineName": "OPV1", "dateAdministered": "2024-02-26", "status": "ADMINISTERED" }
         ],
         "schedules": [
           { "vaccineName": "MEASLES", "dueDate": "2024-07-15", "status": "SCHEDULED" }
         ]
       }
     ],
     "stats": {
       "totalChildren": 1,
       "fullyImmunized": 0,
       "upcomingVaccinations": 1,
       "overdueVaccinations": 0
     }
   }

3. Frontend displays dashboard with all information
```

---

## KEPI Schedule Reference

The system implements Kenya's Expanded Programme on Immunization (KEPI) schedule:

| Age | Vaccine | Code |
|-----|---------|------|
| Birth | Bacillus Calmette-Guérin | BCG |
| Birth | Oral Polio Vaccine 0 | OPV0 |
| Birth | Hepatitis B Birth Dose | HEPB0 |
| 6 weeks | Oral Polio Vaccine 1 | OPV1 |
| 6 weeks | Pentavalent 1 | PENTA1 |
| 6 weeks | PCV 1 | PCV1 |
| 6 weeks | Rotavirus 1 | ROTA1 |
| 10 weeks | Oral Polio Vaccine 2 | OPV2 |
| 10 weeks | Pentavalent 2 | PENTA2 |
| 10 weeks | PCV 2 | PCV2 |
| 10 weeks | Rotavirus 2 | ROTA2 |
| 14 weeks | Oral Polio Vaccine 3 | OPV3 |
| 14 weeks | Pentavalent 3 | PENTA3 |
| 14 weeks | PCV 3 | PCV3 |
| 14 weeks | Rotavirus 3 | ROTA3 |
| 6 months | Vitamin A | VITA1 |
| 9 months | Measles | MEASLES |
| 9 months | Rubella | RUBELLA1 |
| 12 months | Yellow Fever | YELLOW_FEVER |
| 18 months | DPT Booster 1 | DPT_BOOST1 |
| 18 months | OPV Booster | OPV_BOOST |
| 18 months | Vitamin A | VITA2 |
| 24 months | Vitamin A | VITA3 |

---

## Summary

Kinga Yetu Digital's backend is a comprehensive child health tracking system built with modern technologies. It provides:

1. **Secure Authentication** - JWT-based auth with role-based access control
2. **Complete Child Tracking** - From birth through vaccination schedule completion
3. **KEPI Compliance** - Automatic schedule generation based on Kenya's immunization program
4. **Multi-channel Notifications** - Email, SMS, and push notifications for reminders
5. **Analytics & Reporting** - Data-driven insights for public health decision-making
6. **Scalable Architecture** - Modular NestJS design that can grow with the system

The system is designed to work seamlessly with a React frontend to provide a complete solution for tracking child immunizations in Kenya.
