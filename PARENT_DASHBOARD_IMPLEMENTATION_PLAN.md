# Parent Dashboard Backend Integration Plan

A step-by-step plan to integrate all available backend features into the Parent Dashboard, ordered from simplest to hardest.

---

## Phase 1: Quick Fixes (1-2 hours each)

### Task 1.1: Fix Notification Preferences UI
**Difficulty:** ⭐ Easy | **Backend Ready:** ✅ Yes

**What's Broken:**
- Page exists at `/notifications/reminder-settings`
- Hook `useParentPreferences` exists in `frontend/src/features/parents/parentsHooks.ts:290`
- API call exists but UI toggles don't work

**Steps:**
1. Open `frontend/src/pages/notifications/ReminderSettings.tsx`
2. Connect the existing toggles to call `updatePreferences()` from `useParentPreferences`
3. Add three switches: Email, SMS, Push notifications

**Files to Modify:**
- `frontend/src/pages/notifications/ReminderSettings.tsx`

---

### Task 1.2: Display Actual Vaccine Names in Appointments
**Difficulty:** ⭐ Easy | **Backend Ready:** ✅ Yes

**What's Broken:**
- Appointments page shows `reminder.vaccineId` (just an ID, not readable)

**Steps:**
1. Update `frontend/src/pages/appointments/Appointments.tsx`
2. Use the vaccine data from reminders or switch to `/api/schedules/child/:childId`

**Files to Modify:**
- `frontend/src/pages/appointments/Appointments.tsx`

---

### Task 1.3: Static Health Facility in Emergency Contacts
**Difficulty:** ⭐ Easy | **Backend Ready:** ✅ Yes

**What's Broken:**
- Dashboard shows static "Health Facility" instead of actual facility data

**Steps:**
1. Add API call to `GET /api/facilities`
2. Display facility name, phone, address in the Emergency Contacts section

**Files to Modify:**
- `frontend/src/Dashboard/ParentDashboard/ParentDashboard.tsx`
- Add to: `frontend/src/features/facilities/facilitiesAPI.ts`

---

## Phase 2: Medium Complexity (2-4 hours each)

### Task 2.1: Child-Specific Statistics
**Difficulty:** ⭐⭐ Medium | **Backend Ready:** ✅ Yes

**What's Broken:**
- Dashboard shows same stats for ALL children
- Should show per-child completion rates

**Backend Endpoints:**
- `GET /api/schedules/child/:childId/stats`

**Steps:**
1. Create new hook in `frontend/src/features/schedules/schedulesHooks.ts`
2. Call `/api/schedules/child/:childId/stats` for each child
3. Update child cards in ParentDashboard to show individual stats

**Files to Modify:**
- `frontend/src/features/schedules/schedulesHooks.ts`
- `frontend/src/features/schedules/schedulesAPI.ts`
- `frontend/src/Dashboard/ParentDashboard/ParentDashboard.tsx`

---

### Task 2.2: Use Schedules Instead of Reminders for Upcoming
**Difficulty:** ⭐⭐ Medium | **Backend Ready:** ✅ Yes

**What's Broken:**
- Dashboard shows reminders as "upcoming appointments"
- Should use actual vaccination schedules

**Backend Endpoints:**
- `GET /api/schedules/upcoming?daysAhead=30`
- `GET /api/schedules/child/:childId`

**Steps:**
1. Add API call to fetch actual schedules
2. Replace `upcomingReminders` with `upcomingSchedules` in dashboard
3. Show vaccine name, due date, status properly

**Files to Modify:**
- `frontend/src/features/schedules/schedulesAPI.ts`
- `frontend/src/features/schedules/schedulesHooks.ts`
- `frontend/src/Dashboard/ParentDashboard/ParentDashboard.tsx`

---

### Task 2.3: Immunization History Display
**Difficulty:** ⭐⭐ Medium | **Backend Ready:** ✅ Yes

**What's Broken:**
- "Vaccinations" page exists but doesn't show detailed history

**Backend Endpoints:**
- `GET /api/immunizations/child/:childId` - Full history

**Steps:**
1. Check if immunizations API exists in frontend
2. Add or update `frontend/src/features/immunizations/immunizationsAPI.ts`
3. Display: vaccine name, date administered, status, batch number, health worker

**Files to Modify:**
- Create: `frontend/src/features/immunizations/immunizationsAPI.ts`
- Update: `frontend/src/pages/vaccinations/VaccinationsPage.tsx`

---

### Task 2.4: Show Actual Overdue Vaccines
**Difficulty:** ⭐⭐ Medium | **Backend Ready:** ✅ Yes

**What's Broken:**
- Missed Vaccinations count is wrong
- No actual overdue vaccine data shown

**Backend Endpoints:**
- `GET /api/schedules/overdue?daysOverdue=30`

**Steps:**
1. Add API call to fetch overdue schedules
2. Update the "Missed Vaccinations" stat card with real data

**Files to Modify:**
- `frontend/src/features/schedules/schedulesAPI.ts`
- `frontend/src/Dashboard/ParentDashboard/ParentDashboard.tsx`

---

## Phase 3: Complex Features (4-8 hours each)

### Task 3.1: Parent Profile Management
**Difficulty:** ⭐⭐⭐ Complex | **Backend Ready:** ✅ Yes

**What's Broken:**
- No UI for parents to update their emergency contact info

**Backend Endpoints:**
- `PATCH /api/parents/:id` - Update parent

**Steps:**
1. Create a "My Profile" page or section in settings
2. Add form with: emergency contact name, phone number
3. Connect to `useUpdateParentMutation` from parents API

**Files to Modify:**
- Create: `frontend/src/pages/parents/ParentProfile.tsx`
- Update: `frontend/src/routing/routes.ts`
- Update: `frontend/src/Dashboard/ParentDashboard/ParentDashboard.tsx` (add menu item)

---

### Task 3.2: Growth Tracking Display
**Difficulty:** ⭐⭐⭐ Complex | **Backend Ready:** ⚠️ Partial

**What's Broken:**
- Growth tracking page exists but no data shown

**Backend Status:**
- [`GrowthRecord`](backend/prisma/schema.prisma:421) model exists
- Need to check/create controller endpoints

**Steps:**
1. First, verify backend has growth records endpoints
2. If not, create: `backend/src/growth-records/growth-records.controller.ts`
3. Add frontend API: `frontend/src/features/growth/growthRecordsAPI.ts`
4. Display growth charts (weight, height over time)

**Files to Modify:**
- Possibly create: `backend/src/growth-records/` (if missing)
- Create: `frontend/src/features/growth/growthRecordsAPI.ts`
- Update: `frontend/src/pages/growth-tracking/GrowthTrackingPage.tsx`

---

### Task 3.3: Vaccination Rescheduling UI
**Difficulty:** ⭐⭐⭐ Complex | **Backend Ready:** ✅ Yes

**What's Broken:**
- No UI for parents to request rescheduling

**Backend Endpoints:**
- `PATCH /api/schedules/:id/reschedule`

**Steps:**
1. Add "Reschedule" button next to upcoming vaccines
2. Create modal with date picker
3. Add reason text field
4. Call API on submit

**Files to Modify:**
- Create: `frontend/src/features/schedules/components/RescheduleModal.tsx`
- Update: `frontend/src/Dashboard/ParentDashboard/ParentDashboard.tsx`
- Update: `frontend/src/pages/appointments/Appointments.tsx`

---

### Task 3.4: Proper Activity Feed
**Difficulty:** ⭐⭐⭐ Complex | **Backend Ready:** ⚠️ Partial

**What's Broken:**
- "Recent Activity" shows children list instead of actual activities

**Backend Status:**
- No dedicated activity log endpoint for parents
- Can use notifications as activity feed

**Steps:**
1. Use `GET /api/notifications` as activity feed
2. Filter for: VACCINE_REMINDER, APPOINTMENT_CONFIRMATION types
3. Display: date, title, message, isRead status

**Files to Modify:**
- `frontend/src/features/notifications/notificationsAPI.ts`
- `frontend/src/Dashboard/ParentDashboard/ParentDashboard.tsx`

---

### Task 3.5: Certificates Feature
**Difficulty:** ⭐⭐⭐ Complex | **Backend Ready:** ❌ Missing

**What's Broken:**
- Certificates page exists but no data

**Backend Status:**
- No certificate generation endpoint found

**Steps:**
1. Create backend endpoint for immunization certificate
2. Generate PDF with child's vaccination history
3. Add download button to frontend

**Files to Modify:**
- Create: `backend/src/certificates/certificates.controller.ts`
- Create: `backend/src/certificates/certificates.service.ts`
- Update: `frontend/src/pages/certificates/CertificatesPage.tsx`

---

## Implementation Order (Recommended)

```
Week 1:
├── Day 1-2: Task 1.1 (Notification Preferences)
├── Day 3:   Task 1.2 (Vaccine Names)
└── Day 4:   Task 1.3 (Health Facility)

Week 2:
├── Day 1-2: Task 2.1 (Child-Specific Stats)
├── Day 3:   Task 2.2 (Use Schedules)
└── Day 4:   Task 2.3 (Immunization History)

Week 3:
├── Day 1-2: Task 2.4 (Overdue Vaccines)
├── Day 3-4: Task 3.1 (Parent Profile)
└── Day 5:   Task 3.2 (Growth Tracking)

Week 4:
├── Day 1-2: Task 3.3 (Rescheduling UI)
├── Day 3-4: Task 3.4 (Activity Feed)
└── Day 5:   Task 3.5 (Certificates)
```

---

## Quick Start - First 3 Tasks

Start with these to see quick progress:

1. **Fix Notification Preferences** - Just connect existing hook to UI
2. **Show Vaccine Names** - One line change to display proper data
3. **Health Facility Data** - Fetch from existing facilities API

These will give immediate visible improvements with minimal code changes.
