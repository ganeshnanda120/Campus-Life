import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';

// Public Auth Pages (Lazy Loaded)
const LoginPage = React.lazy(() => import('../pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const ActivatePage = React.lazy(() => import('../pages/auth/ActivatePage').then((m) => ({ default: m.ActivatePage })));

// Main Pages (Lazy Loaded for optimal code splitting)
const DashboardPage = React.lazy(() => import('../pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const StudentManagementPage = React.lazy(() => import('../pages/students/StudentManagementPage').then((m) => ({ default: m.StudentManagementPage })));
const SubAdminManagementPage = React.lazy(() => import('../pages/admin/SubAdminManagementPage').then((m) => ({ default: m.SubAdminManagementPage })));
const FacultyManagementPage = React.lazy(() => import('../pages/admin/FacultyManagementPage').then((m) => ({ default: m.FacultyManagementPage })));
const RequestsPage = React.lazy(() => import('../pages/requests/RequestsPage').then((m) => ({ default: m.RequestsPage })));
const ComplaintsPage = React.lazy(() => import('../pages/complaints/ComplaintsPage').then((m) => ({ default: m.ComplaintsPage })));
const GatePassPage = React.lazy(() => import('../pages/gatepass/GatePassPage').then((m) => ({ default: m.GatePassPage })));
const AttendancePage = React.lazy(() => import('../pages/attendance/AttendancePage').then((m) => ({ default: m.AttendancePage })));
const TimetablePage = React.lazy(() => import('../pages/timetable/TimetablePage').then((m) => ({ default: m.TimetablePage })));
const HostelPage = React.lazy(() => import('../pages/hostel/HostelPage').then((m) => ({ default: m.HostelPage })));
const MessPage = React.lazy(() => import('../pages/mess/MessPage').then((m) => ({ default: m.MessPage })));
const NoticesPage = React.lazy(() => import('../pages/notices/NoticesPage').then((m) => ({ default: m.NoticesPage })));
const NotificationsPage = React.lazy(() => import('../pages/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const ProfilePage = React.lazy(() => import('../pages/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const DigitalIdCardPage = React.lazy(() => import('../pages/idcard/DigitalIdCardPage').then((m) => ({ default: m.DigitalIdCardPage })));
const ServiceDirectoryPage = React.lazy(() => import('../pages/services/ServiceDirectoryPage').then((m) => ({ default: m.ServiceDirectoryPage })));
const CalendarPage = React.lazy(() => import('../pages/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage })));
const LostFoundPage = React.lazy(() => import('../pages/lostfound/LostFoundPage').then((m) => ({ default: m.LostFoundPage })));
const PollsPage = React.lazy(() => import('../pages/polls/PollsPage').then((m) => ({ default: m.PollsPage })));
const HelpCenterPage = React.lazy(() => import('../pages/help/HelpCenterPage').then((m) => ({ default: m.HelpCenterPage })));
const UniversalSearchPage = React.lazy(() => import('../pages/search/UniversalSearchPage').then((m) => ({ default: m.UniversalSearchPage })));
const AnalyticsReportsPage = React.lazy(() => import('../pages/admin/AnalyticsReportsPage').then((m) => ({ default: m.AnalyticsReportsPage })));
const AuditLogsPage = React.lazy(() => import('../pages/admin/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })));
const NotFoundPage = React.lazy(() => import('../pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

const RouteLoadingFallback = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '1rem',
    }}
  >
    <div className="spinner" style={{ width: 36, height: 36 }} />
    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
      Loading page...
    </span>
  </div>
);

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
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

        {/* Direct Operation Routes */}
        <Route path="/requests" element={<RequestsPage />} />
        <Route path="/complaints" element={<ComplaintsPage />} />
        <Route path="/gate-pass" element={<GatePassPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/timetable" element={<TimetablePage />} />
        <Route path="/hostel" element={<HostelPage />} />
        <Route path="/mess" element={<MessPage />} />

        {/* Administration Modules with Explicit Role-Guards (Section 18) */}
        <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/admin/students"
          element={
            <ProtectedRoute allowedRoles={['MAIN_ADMIN', 'SUB_ADMIN', 'FACULTY', 'STAFF']} requiredPermission="MANAGE_STUDENTS">
              <StudentManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/sub-admins"
          element={
            <ProtectedRoute allowedRoles={['MAIN_ADMIN', 'SUB_ADMIN', 'FACULTY', 'STAFF']} requiredPermission="MANAGE_SUB_ADMINS">
              <SubAdminManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/faculty"
          element={
            <ProtectedRoute allowedRoles={['MAIN_ADMIN', 'SUB_ADMIN', 'FACULTY', 'STAFF']} requiredPermission="MANAGE_FACULTY">
              <FacultyManagementPage initialTab="faculty" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/staff"
          element={
            <ProtectedRoute allowedRoles={['MAIN_ADMIN', 'SUB_ADMIN', 'FACULTY', 'STAFF']} requiredPermission="MANAGE_STAFF">
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
  </Suspense>
);
};
