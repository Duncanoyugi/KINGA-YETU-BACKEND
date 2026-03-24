# Kinga Yetu Digital - Backend System Explained

Welcome! This document explains how the Kinga Yetu Digital backend works. Imagine you're completely new to this system - we'll start from the basics and build up to understanding how everything connects.

## Table of Contents
1. [What is this system?](#what-is-this-system)
2. [High-Level Architecture](#high-level-architecture)
3. [Technology Stack](#technology-stack)
4. [Database Structure](#database-structure)
5. [Core Modules Explained](#core-modules-explained)
6. [How Users Flow Through the System](#how-users-flow-through-the-system)
7. [Security & Authentication](#security--authentication)
8. [Background Jobs & Automation](#background-jobs--automation)
9. [API Endpoints Overview](#api-endpoints-overview)
10. [System Workflows](#system-workflows)

---

## 1. What is this system?

**Kinga Yetu Digital** is a digital health immunization tracking system designed for Kenya's vaccination program. It helps:

- **Parents** track their children's vaccinations and receive reminders
- **Health Workers** record immunizations and manage patient data
- **Administrators** analyze vaccination coverage and generate reports
- **The System** automatically sends reminders and tracks vaccination schedules

Think of it like a digital vaccination card that never gets lost, plus smart reminders so parents never miss a vaccine appointment.

---

## 2. High-Level Architecture

### The Big Picture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                              │
│   (Mobile/Web App that users interact with)                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP Requests (JSON)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     NESTJS BACKEND SERVER                              │
│   (Handles all business logic and data processing)                    │
│                                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│  │  Auth API   │ │  Children   │ │  Vaccines   │ │  Reports   │      │
│  │   Module    │ │    API      │ │    API      │ │    API     │      │
│  │             │ │             │ │             │ │             │      │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘      │
│                                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│  │  Reminders  │ │  Analytics  │ │  Notifica- │ │   OTP &    │      │
│  │    API      │ │    API      │ │   tions    │ │  Mailer    │      │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Database Queries
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     POSTGRESQL DATABASE                                │
│   (Stores all data: users, children, vaccines, schedules, etc.)    │
└─────────────────────────────────────────────────────────────────────────┘
```

### How it works in simple terms:

1. **User interacts with the Frontend** - A parent opens the app to view their child's vaccination schedule
2. **Frontend sends request to Backend** - The app sends an HTTP request like "Give me the vaccination schedule for child ID 123"
3. **Backend processes the request** - NestJS receives the request, validates it, checks permissions
4. **Backend talks to Database** - If allowed, NestJS asks PostgreSQL for the data
5. **Database returns data** - PostgreSQL finds and returns the requested information
6. **Backend responds to Frontend** - NestJS formats the data as JSON and sends it back
7. **Frontend displays to User** - The app shows the vaccination schedule to the parent

---

## 3. Technology Stack

### Core Technologies Used:

| Technology | Purpose | Analogy |
|------------|----------|---------|
| **NestJS** | Backend framework | The "brain" that processes all requests |
| **PostgreSQL** | Database | A highly organized digital filing cabinet |
| **Prisma** | Database ORM | A translator that converts code to database queries |
| **JWT** | Authentication | A digital ID card that proves who you are |
| **Passport.js** | Authentication strategy | A security guard that checks your ID |
| **Node.js** | JavaScript runtime | The engine that runs everything |
| **TypeScript** | Programming language | JavaScript with superpowers (type safety) |

### Supporting Tools:

| Tool | Purpose |
|------|---------|
| **@nestjs/schedule** | Runs background tasks (like clock) |
| **@nestjs/config** | Manages environment variables (secrets) |
| **class-validator** | Validates incoming data |
| **Swagger/OpenAPI** | Auto-generates API documentation |

---

## 4. Database Structure

The database is the heart of the system. Here's how the data is organized:

### Main Entities (Tables):

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USERS                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ id: String (unique ID)                                                 │ │
│  │ email: String (login)                                                  │ │
│  │ password: String (hashed)                                             │ │
│  │ fullName: String                                                      │ │
│  │ role: PARENT | HEALTH_WORKER | ADMIN | SUPER_ADMIN                   │ │
│  │ isActive: Boolean                                                     │ │
│  │ isEmailVerified: Boolean                                              │ │
│  │ isPhoneVerified: Boolean                                              │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
         │
         │ (One-to-One)
         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        PARENT PROFILE                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ id: String                                                            │ │
│  │ userId: String (links to User)                                        │ │
│  │ emergencyContact: String                                             │ │
│  │ emergencyPhone: String                                               │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
         │
         │ (One-to-Many)
         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CHILDREN                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ id: String                                                            │ │
│  │ parentId: String (links to Parent)                                   │ │
│  │ firstName: String                                                    │ │
│  │ lastName: String                                                     │ │
│  │ dateOfBirth: DateTime                                                │ │
│  │ gender: MALE | FEMALE | OTHER                                        │ │
│  │ birthCertificateNo: String (unique)                                  │ │
│  │ birthWeight: Float                                                  │ │
│  │ birthHeight: Float                                                  │ │
│  │ deliveryMethod: String                                               │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
         │
         │ (One-to-Many)
         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        VACCINATION SCHEDULES                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ id: String                                                            │ │
│  │ childId: String (links to Child)                                     │ │
│  │ vaccineId: String (links to Vaccine)                                 │ │
│  │ dueDate: DateTime (when vaccine is due)                              │ │
│  │ status: SCHEDULED | PENDING | ADMINISTERED | MISSED | CONTRAINDICATED│ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
         │
         │ (One-to-Many)
         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            IMMUNIZATIONS                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ id: String                                                            │ │
│  │ childId: String                                                      │ │
│  │ vaccineId: String                                                    │ │
│  │ facilityId: String (where administered)                              │ │
│  │ healthWorkerId: String (who administered)                           │ │
│  │ dateAdministered: DateTime                                          │ │
│  │ ageAtDays: Integer                                                   │ │
│  │ status: ADMINISTERED                                                │ │
│  │ batchNumber: String                                                  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Other Important Entities:

- **Vaccines** - Master list of all vaccines (BCG, Polio, measles, etc.)
- **Health Facilities** - Clinics, hospitals where immunizations happen
- **Reminders** - Scheduled notifications for upcoming vaccines
- **Notifications** - Messages sent to users (emails, SMS, push)
- **Reports** - Generated analytics and coverage reports
- **Audit Logs** - Track who did what (for security)

---

## 5. Core Modules Explained

The backend is organized into **modules**. Each module is like a department in a company, handling a specific area of functionality.

### Module 1: Auth Module (Security & Authentication)

**Location:** `backend/src/auth/`

**Purpose:** Handles user registration, login, password management, and security.

**Key Components:**
- `auth.controller.ts` - The API endpoints (login, register, reset password)
- `auth.service.ts` - The business logic (verify password, generate tokens)
- `auth.module.ts` - Groups everything together
- `strategies/jwt.strategy.ts` - Validates JWT tokens on every request
- `guards/jwt-auth.guard.ts` - Protects routes from unauthorized access
- `guards/roles.guard.ts` - Ensures users have proper permissions

**How it works:**
1. User registers with email and password
2. Password is hashed (encrypted) before storing
3. User logs in with email and password
4. Server verifies password and generates a JWT token
5. JWT token is returned to user
6. User includes token in all future requests
7. Server validates token on each request

### Module 2: Users Module (User Management)

**Location:** `backend/src/users/`

**Purpose:** Manages user accounts and profiles.

**Key Features:**
- Create, read, update, delete users
- Change user roles (parent, health worker, admin)
- Activate/deactivate accounts
- Search users

### Module 3: Children Module (Child Registration & Management)

**Location:** `backend/src/children/`

**Purpose:** Handles child registration and health records.

**Key Features:**
- Register new children
- Search children by name or birth certificate
- Get all children for a parent
- Update child information
- Track growth records
- Track development milestones

**Flow:**
```
Parent logs in → Creates child profile → System generates vaccination schedule
```

### Module 4: Vaccines Module (Vaccine Management)

**Location:** `backend/src/vaccines/`

**Purpose:** Manages the master list of vaccines.

**Key Features:**
- Store vaccine information (name, code, dosage, side effects)
- Get vaccines by age (what vaccines does a 2-month-old need?)
- KEPI schedule (Kenya's standard immunization schedule)
- Seed default vaccines into database

### Module 5: Immunizations Module (Recording Vaccinations)

**Location:** `backend/src/immunizations/`

**Purpose:** Records when children receive vaccines.

**Key Features:**
- Record a new immunization
- Get immunization history for a child
- Today's immunizations by facility
- Search immunization records

**Flow:**
```
Health Worker logs in → Finds child → Records vaccine administration → 
Updates vaccination schedule status
```

### Module 6: Schedules Module (Vaccination Scheduling)

**Location:** `backend/src/schedules/`

**Purpose:** Manages vaccination schedules.

**Key Features:**
- Generate vaccination schedules for children
- Get upcoming vaccines
- Get overdue vaccines
- Reschedule vaccines

**The Magic:** When a child is registered, the system automatically generates a complete vaccination schedule based on KEPI (Kenya Expanded Programme on Immunization).

### Module 7: Reminders Module (Automated Notifications)

**Location:** `backend/src/reminders/`

**Purpose:** Sends reminders to parents about upcoming vaccinations.

**Key Features:**
- Create reminders for vaccines
- Bulk create reminders
- Send reminders (email, SMS, push)
- Track reminder status
- Reschedule/cancel reminders

**Automation:** A background job runs every 5 minutes to:
- Process pending reminders
- Send due reminders
- Escalate missed appointments

### Module 8: Notifications Module (Multi-Channel Messaging)

**Location:** `backend/src/notifications/`

**Purpose:** Sends notifications through various channels.

**Providers:**
- `EmailProvider` - Sends emails (via Mailtrap/SMTP)
- `SmsProvider` - Sends SMS (via Africa's Talking)
- `PushProvider` - Sends push notifications

**Key Features:**
- Create notifications
- Mark as read
- Get unread count
- Send bulk notifications

### Module 9: Reports Module (Analytics & Reporting)

**Location:** `backend/src/reports/`

**Purpose:** Generates various reports.

**Report Types:**
- Coverage reports (% of children vaccinated)
- Missed vaccines reports
- Facility performance reports
- Custom reports

**Key Features:**
- Generate reports on-demand
- Schedule reports (daily, weekly, monthly)
- Download reports (PDF, CSV, Excel, JSON)
- Export report list

### Module 10: Analytics Module (Data Analysis)

**Location:** `backend/src/analytics/`

**Purpose:** Analyzes vaccination data for insights.

**Key Features:**
- Coverage rate calculations
- Dropout rate analysis
- Timeliness analysis
- Outbreak risk predictions
- Anomaly detection
- Real-time dashboard data
- Trend analysis

### Module 11: Facilities Module (Health Facility Management)

**Location:** `backend/src/facilities/`

**Purpose:** Manages health facilities.

**Key Features:**
- Create/update/delete facilities
- List facilities by county
- Activate/deactivate facilities

### Module 12: OTP Module (One-Time Passwords)

**Location:** `backend/src/otp/`

**Purpose:** Handles OTP for verification.

**Key Features:**
- Generate OTP (for registration, password reset)
- Verify OTP
- Resend OTP

### Module 13: Mailer Module (Email Sending)

**Location:** `backend/src/mailer/`

**Purpose:** Handles email sending.

**Uses:** Mailtrap for development, can be configured for production email services (SendGrid, AWS SES, etc.)

---

## 6. How Users Flow Through the System

### User Roles:

| Role | Permissions | Typical Users |
|------|-------------|---------------|
| **PARENT** | View own children, receive reminders | Parents/guardians |
| **HEALTH_WORKER** | Record immunizations, manage children | Nurses, doctors |
| **ADMIN** | Manage facilities, generate reports | County health officers |
| **SUPER_ADMIN** | System-wide administration | System administrators |

### Flow 1: Parent Registration & Use

```
1. User visits the app
2. Clicks "Register"
3. Fills in: name, email, phone, password
4. Backend creates User account
5. Backend creates Parent profile
6. Backend sends verification email
7. User verifies email (clicks link)
8. User logs in with email/password
9. User creates child profile (name, DOB, etc.)
10. System generates vaccination schedule
11. System sends welcome email with schedule
12. Parent can view upcoming vaccines
13. Parent receives SMS/email reminders before due dates
```

### Flow 2: Health Worker Recording Immunization

```
1. Health worker logs in
2. Searches for child (by name or birth cert)
3. Selects the child
4. Chooses vaccine administered
5. Confirms date and batch number
6. System records immunization
7. System updates vaccination schedule
8. Parent receives notification of immunization
```

### Flow 3: Generating Reports

```
1. Admin logs in
2. Selects report type (e.g., "Coverage Report")
3. Sets parameters (county, date range)
4. Clicks "Generate"
5. System calculates coverage rates
6. Report is generated
7. Admin can download (PDF/CSV)
8. System can email report
```

---

## 7. Security & Authentication

### JWT (JSON Web Tokens)

Instead of storing login sessions in the database, the system uses JWTs:

```
User logs in
    │
    ▼
Server verifies password
    │
    ▼
Server creates a "token" (like a digital ID card) containing:
  - User ID
  - User role
  - Expiration date
    │
    ▼
Server sends token to frontend
    │
    ▼
Frontend stores token
    │
    ▼
Frontend sends token with every request
    │
    ▼
Server validates token on each request
    │
    ▼
If valid, server processes request
If invalid, server returns 401 Unauthorized
```

### Password Security

- Passwords are **hashed** using bcrypt before storing
- Hashing is one-way (can't reverse to get original password)
- When logging in, password is hashed again and compared

### Role-Based Access Control (RBAC)

Different roles have different permissions:

```
/api/children (POST) - PARENT, HEALTH_WORKER, ADMIN, SUPER_ADMIN
/api/children (GET)  - PARENT, HEALTH_WORKER, ADMIN, SUPER_ADMIN
/api/vaccines (POST) - ADMIN, SUPER_ADMIN only
/api/reports (GET)   - ADMIN, SUPER_ADMIN only
```

---

## 8. Background Jobs & Automation

The system uses `@nestjs/schedule` to run automated tasks:

### Scheduled Tasks:

1. **Every 5 minutes:** Process pending reminders
   - Check for reminders due to be sent
   - Send reminders via email/SMS/push
   - Update reminder status

2. **Every 5 minutes:** Process pending notifications
   - Send queued notifications

3. **Every 5 minutes:** Escalate missed appointments
   - Find overdue vaccinations
   - Send escalation notifications

4. **Daily:** Clean old data
   - Delete old notifications (after 30 days)
   - Clean up old sessions

---

## 9. API Endpoints Overview

All API endpoints start with `/api/` (set in main.ts).

### Main Endpoint Groups:

| Prefix | Description | Example |
|--------|-------------|---------|
| `/api/auth` | Authentication | `/api/auth/login` |
| `/api/users` | User management | `/api/users` |
| `/api/parents` | Parent profiles | `/api/parents/:id/dashboard` |
| `/api/children` | Child records | `/api/children` |
| `/api/vaccines` | Vaccine catalog | `/api/vaccines/kepi-schedule` |
| `/api/immunizations` | Immunization records | `/api/immunizations` |
| `/api/schedules` | Vaccination schedules | `/api/schedules/upcoming` |
| `/api/reminders` | Reminder management | `/api/reminders` |
| `/api/notifications` | User notifications | `/api/notifications/user/:userId` |
| `/api/reports` | Report generation | `/api/reports/coverage` |
| `/api/analytics` | Data analysis | `/api/analytics/dashboard` |
| `/api/facilities` | Health facilities | `/api/facilities` |
| `/api/otp` | OTP handling | `/api/otp/generate` |
| `/api/mailer` | Email testing | `/api/mailer/test` |

---

## 10. System Workflows

### Workflow 1: Child Registration

```
1. Parent logs in (POST /api/auth/login)
2. Parent calls POST /api/children with:
   - firstName, lastName, dateOfBirth, gender
   - Optional: birthCertificateNo, birthWeight, birthHeight
3. ChildrenService validates data
4. ChildrenService creates child record in database
5. ChildrenService links child to parent's Parent profile
6. ChildrenService calls VaccineSchedulerService.generateSchedule()
7. VaccineSchedulerService:
   - Gets all vaccines from database
   - Calculates due dates based on child's dateOfBirth
   - Creates VaccinationSchedule records
8. ChildrenService returns created child with schedule
9. ReminderService creates reminders for each scheduled vaccine
10. Parent receives welcome notification
```

### Workflow 2: Recording Immunization

```
1. Health worker logs in
2. Health worker calls POST /api/immunizations with:
   - childId, vaccineId, facilityId
   - dateAdministered, batchNumber, notes
3. ImmunizationsService validates:
   - Child exists
   - Vaccine exists
   - Facility exists
   - Health worker is authorized
4. ImmunizationsService creates immunization record
5. ImmunizationsService updates VaccinationSchedule status to ADMINISTERED
6. ImmunizationsService returns created immunization
7. Parent receives notification: "Your child received [vaccine name]"
```

### Workflow 3: Sending Reminders

```
1. ReminderEngineService runs every 5 minutes (cron job)
2. ReminderEngineService queries for PENDING reminders where scheduledFor <= now()
3. For each reminder:
   a. Get child and parent details
   b. Get vaccine details
   c. Format message based on reminder type (EMAIL, SMS, PUSH)
   d. Send via appropriate provider:
      - EMAIL: MailerService.sendEmail()
      - SMS: SmsProvider.sendSms()
      - PUSH: PushProvider.sendPush()
   e. If successful: update status to SENT
   f. If failed: increment retryCount, store error
4. Escalate overdue vaccinations:
   a. Find scheduled vaccines where dueDate < now() and status != ADMINISTERED
   b. Create escalation reminders
   c. Send urgent notifications
```

### Workflow 4: Generating Coverage Report

```
1. Admin calls POST /api/reports/coverage with:
   - county (optional)
   - startDate, endDate
2. ReportsService validates parameters
3. ReportsService queries database:
   - Total registered children
   - Children who received each vaccine
   - Calculate coverage percentages
4. ReportsService generates report data
5. ReportGeneratorService formats as PDF/CSV/JSON
6. Report saved to storage
7. Report metadata saved to database
8. Admin can download via /api/reports/:id/download-url
```

---

## Summary

The Kinga Yetu Digital backend is a comprehensive immunization tracking system built with modern technologies:

- **NestJS** provides a structured, modular architecture
- **PostgreSQL** stores all data reliably
- **Prisma** makes database operations easy
- **JWT** provides secure authentication
- **Background jobs** automate reminders and notifications

The system follows best practices:
- **RESTful API design**
- **Role-based security**
- **Separation of concerns** (different modules for different features)
- **Validation** at every entry point
- **Error handling** throughout

This architecture allows the system to efficiently manage thousands of children, track their vaccinations, send timely reminders, and generate comprehensive reports for health administrators.

---

## File Structure Overview

```
backend/
├── prisma/
│   ├── schema.prisma          # Database schema definition
│   └── migrations/             # Database migrations
├── src/
│   ├── main.ts                 # Application entry point
│   ├── app.module.ts           # Root module
│   ├── app.controller.ts       # Root controller
│   ├── app.service.ts         # Root service
│   ├── prisma/                # Database connection
│   ├── auth/                  # Authentication module
│   ├── users/                 # User management
│   ├── parents/               # Parent profiles
│   ├── children/              # Child management
│   ├── vaccines/              # Vaccine catalog
│   ├── immunizations/         # Immunization records
│   ├── schedules/              # Vaccination schedules
│   ├── reminders/             # Reminder management
│   ├── notifications/          # Notification system
│   ├── reports/               # Report generation
│   ├── analytics/             # Data analysis
│   ├── facilities/            # Health facilities
│   ├── otp/                   # OTP handling
│   └── mailer/                # Email service
└── package.json               # Dependencies
```

---

## 11. Testing the Backend (API Testing Guide)

This section provides examples of how to test the backend API endpoints.

### Base URL

- **Local Development:** `http://localhost:5000/api`
- **Production/Deployed:** `https://kinga-yetu-backend.onrender.com/api`

### Authentication Flow

All protected endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### Test Scenarios

#### 1. Login as PARENT

```
POST {{authUrl}}/login
Content-Type: application/json

{
  "email": "vivian@gmail.com",
  "password": "Vivian@1234"
}
```

**Expected Response:**
```json
{
  "user": {
    "id": "...",
    "email": "vivian@gmail.com",
    "role": "PARENT",
    "parentProfile": {
      "id": "...",
      "userId": "..."
    }
  },
  "accessToken": "eyJhbGci..."
}
```

#### 2. Get Current User Profile

```
GET {{authUrl}}/me
Authorization: Bearer <token>
```

#### 3. Get List of Vaccines (Public)

```
GET /api/vaccines
Authorization: Bearer <token>
```


#### 4. Get List of Health Facilities


```
GET /api/facilities
Authorization: Bearer <token>
```

#### 5. Register a Child (PARENT role)

```
POST /api/children
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "ChildFirstName",
  "lastName": "ChildLastName",
  "dateOfBirth": "2025-03-01",
  "gender": "MALE"
}
```

**Note:** Creating a child will automatically generate a vaccination schedule based on KEPI (Kenya Expanded Programme on Immunization).

#### 6. Get Upcoming Vaccines (HEALTH_WORKER, ADMIN, SUPER_ADMIN only)

```
GET /api/schedules/upcoming
Authorization: Bearer <token>
```

### Role-Based Access Control

The system implements strict role-based access control:

| Endpoint | PARENT | HEALTH_WORKER | ADMIN | SUPER_ADMIN |
|----------|--------|----------------|------|-------------|
| POST /api/children | ✓ | ✓ | ✓ | ✓ |
| GET /api/children | ✓ | ✓ | ✓ | ✓ |
| GET /api/schedules/upcoming | ✗ | ✓ | ✓ | ✓ |
| GET /api/parents/dashboard | ✗ | ✓ | ✓ | ✓ |
| POST /api/reports/* | ✗ | ✗ | ✓ | ✓ |
| GET /api/analytics/* | ✗ | ✗ | ✓ | ✓ |

### Known Issues / Troubleshooting

1. **Database Migration Issues:** If you encounter "Column does not exist" errors, ensure all Prisma migrations have been applied to the database. Run:
   ```
   npx prisma migrate deploy
   ```

2. **Authentication Errors:** Make sure to include the JWT token in all protected requests.

3. **Role Errors:** Some endpoints are restricted to certain roles. If you get a 403 Forbidden error, your role doesn't have permission to access that endpoint.

4. **Child Registration 500 Error:** If POST /api/children returns 500 Internal Server Error, this indicates a database schema mismatch. The deployed database is missing columns that exist in the Prisma schema (e.g., `birthWeight`, `birthHeight` in the children table). To fix this, manually run SQL to add the missing columns:
   ```sql
   ALTER TABLE children ADD COLUMN birthWeight DOUBLE PRECISION;
   ALTER TABLE children ADD COLUMN birthHeight DOUBLE PRECISION;
   ALTER TABLE children ADD COLUMN deliveryMethod TEXT;
   ALTER TABLE children ADD COLUMN gestationalAge TEXT;
   ALTER TABLE children ADD COLUMN complications TEXT;
   ALTER TABLE children ADD COLUMN notes TEXT;
   ```
   Then restart the server to clear any cached schema.

---

*This testing guide helps you understand how to interact with the Kinga Yetu Digital backend API.*
