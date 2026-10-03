import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';

// Public Auth Pages
import { LoginPage } from '../pages/auth/LoginPage';
import { ActivatePage } from '../pages/auth/ActivatePage';

// Main Pages
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { StudentManagementPage } from '../pages/students/StudentManagementPage';
import { SubAdminManagementPage } from '../pages/admin/SubAdminManagementPage';
import { FacultyManagementPage } from '../pages/admin/FacultyManagementPage';
import { RequestsPage } from '../pages/requests/RequestsPage';
import { ComplaintsPage } from '../pages/complaints/ComplaintsPage';
import { GatePassPage } from '../pages/gatepass/GatePassPage';
import { AttendancePage } from '../pages/attendance/AttendancePage';
import { TimetablePage } from '../pages/timetable/TimetablePage';
import { HostelPage } from '../pages/hostel/HostelPage';
import { MessPage } from '../pages/mess/MessPage';
import { NoticesPage } from '../pages/notices/NoticesPage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';
import { ProfilePage } from '../pages/profile/ProfilePage';
import { DigitalIdCardPage } from '../pages/idcard/DigitalIdCardPage';
import { ServiceDirectoryPage } from '../pages/services/ServiceDirectoryPage';
import { CalendarPage } from '../pages/calendar/CalendarPage';
import { LostFoundPage } from '../pages/lostfound/LostFoundPage';
import { PollsPage } from '../pages/polls/PollsPage';
import { HelpCenterPage } from '../pages/help/HelpCenterPage';
import { UniversalSearchPage } from '../pages/search/UniversalSearchPage';
import { AnalyticsReportsPage } from '../pages/admin/AnalyticsReportsPage';
import { AuditLogsPage } from '../pages/admin/AuditLogsPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Authentication Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/activate" element={<ActivatePage />} />

      {/* Authenticated Application Routes (Section 17) */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Student & Operations Workflows */}
        <Route path="/student/requests" element={<RequestsPage />} />
        <Route path="/student/complaints" element={<ComplaintsPage />} />
        <Route path="/student/gate-pass" element={<GatePassPage />} />
        <Route path="/student/attendance" element={<AttendancePage />} />
        <Route path="/student/timetable" element={<TimetablePage />} />
        <Route path="/student/hostel" element={<HostelPage />} />
        <Route path="/student/mess" element={<MessPage />} />
        <Route path="/notices" element={<NoticesPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/id-card" element={<DigitalIdCardPage />} />

        {/* Administration Modules with Explicit Role-Guards (Section 18) */}
        <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/admin/students"
          element={
            <ProtectedRoute allowedRoles={['MAIN_ADMIN', 'SUB_ADMIN']} requiredPermission="MANAGE_STUDENTS">
              <StudentManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/sub-admins"
          element={
            <ProtectedRoute allowedRoles={['MAIN_ADMIN', 'SUB_ADMIN']} requiredPermission="MANAGE_SUB_ADMINS">
              <SubAdminManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/faculty"
          element={
            <ProtectedRoute allowedRoles={['MAIN_ADMIN', 'SUB_ADMIN']} requiredPermission="MANAGE_FACULTY">
              <FacultyManagementPage initialTab="faculty" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/staff"
          element={
            <ProtectedRoute allowedRoles={['MAIN_ADMIN', 'SUB_ADMIN']} requiredPermission="MANAGE_STAFF">
              <FacultyManagementPage initialTab="staff" />
            </ProtectedRoute>
          }
        />
        <Route path="/admin/requests" element={<RequestsPage />} />
        <Route path="/admin/complaints" element={<ComplaintsPage />} />
        <Route path="/admin/gate-passes" element={<GatePassPage />} />
        <Route path="/admin/hostel" element={<HostelPage />} />
        <Route path="/admin/mess" element={<MessPage />} />
        <Route path="/admin/notices" element={<NoticesPage />} />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute allowedRoles={['MAIN_ADMIN', 'SUB_ADMIN']} requiredPermission="VIEW_REPORTS">
              <AnalyticsReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <ProtectedRoute allowedRoles={['MAIN_ADMIN', 'SUB_ADMIN']} requiredPermission="VIEW_AUDIT_LOGS">
              <AuditLogsPage />
            </ProtectedRoute>
          }
        />

        {/* Campus Services */}
        <Route path="/service-directory" element={<ServiceDirectoryPage />} />
        <Route path="/services" element={<ServiceDirectoryPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/lost-found" element={<LostFoundPage />} />
        <Route path="/polls" element={<PollsPage />} />
        <Route path="/help" element={<HelpCenterPage />} />
        <Route path="/search" element={<UniversalSearchPage />} />

        {/* 404 Catch-All */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};
