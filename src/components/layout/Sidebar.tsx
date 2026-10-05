import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  ShieldAlert,
  FileText,
  AlertTriangle,
  DoorOpen,
  CalendarCheck,
  Calendar,
  Building,
  Utensils,
  Megaphone,
  BookOpen,
  HelpCircle,
  PackageSearch,
  BarChart3,
  History,
  IdCard,
  X,
  Vote,
  Compass
} from 'lucide-react';
import type { UserRole } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: UserRole;
}

interface NavItemConfig {
  label: string;
  to: string;
  icon: React.ReactNode;
  roles?: UserRole[];
  badge?: string | number;
}

interface NavGroupConfig {
  title: string;
  items: NavItemConfig[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  userRole = 'MAIN_ADMIN',
}) => {
  const navGroups: NavGroupConfig[] = [
    {
      title: 'Core Operations',
      items: [
        { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard size={18} /> },
        { label: 'Requests & Certificates', to: '/student/requests', icon: <FileText size={18} /> },
        { label: 'Complaints & SLA', to: '/student/complaints', icon: <AlertTriangle size={18} /> },
        { label: 'Gate Pass', to: '/student/gate-pass', icon: <DoorOpen size={18} /> },
        { label: 'Digital Campus ID', to: '/id-card', icon: <IdCard size={18} /> },
      ],
    },
    {
      title: 'Academics & Life',
      items: [
        { label: 'Attendance', to: '/student/attendance', icon: <CalendarCheck size={18} /> },
        { label: 'Timetable', to: '/student/timetable', icon: <Calendar size={18} /> },
        { label: 'Hostel Operations', to: '/student/hostel', icon: <Building size={18} /> },
        { label: 'Mess & Menus', to: '/student/mess', icon: <Utensils size={18} /> },
        { label: 'Notices & Circulars', to: '/notices', icon: <Megaphone size={18} /> },
      ],
    },
    {
      title: 'Campus Services',
      items: [
        { label: 'Service Directory', to: '/service-directory', icon: <Compass size={18} /> },
        { label: 'Campus Calendar', to: '/calendar', icon: <BookOpen size={18} /> },
        { label: 'Lost & Found', to: '/lost-found', icon: <PackageSearch size={18} /> },
        { label: 'Campus Polls', to: '/polls', icon: <Vote size={18} /> },
        { label: 'Help Center & FAQ', to: '/help', icon: <HelpCircle size={18} /> },
      ],
    },
    {
      title: 'Administration',
      items: [
        { label: 'Student Management', to: '/admin/students', icon: <Users size={18} />, roles: ['MAIN_ADMIN', 'SUB_ADMIN'] },
        { label: 'Faculty & Staff', to: '/admin/faculty', icon: <UserCheck size={18} />, roles: ['MAIN_ADMIN', 'SUB_ADMIN'] },
        { label: 'Sub-Admins & Roles', to: '/admin/sub-admins', icon: <ShieldAlert size={18} />, roles: ['MAIN_ADMIN', 'SUB_ADMIN'] },
        { label: 'Operational Analytics', to: '/admin/reports', icon: <BarChart3 size={18} />, roles: ['MAIN_ADMIN', 'SUB_ADMIN'] },
        { label: 'Audit Trail Logs', to: '/admin/audit-logs', icon: <History size={18} />, roles: ['MAIN_ADMIN', 'SUB_ADMIN'] },
      ],
    },
  ];

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'active' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`app-sidebar h-[calc(100vh-4rem)] flex-shrink-0 flex flex-col ${isOpen ? 'mobile-open' : ''}`}>
        <div
          className="sidebar-mobile-header"
          style={{
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Navigation Menu
          </span>
          <button
            type="button"
            className="btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Close sidebar menu"
            style={{ width: 32, height: 32 }}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => {
              if (!item.roles) return true;
              return item.roles.includes(userRole);
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title} style={{ marginBottom: '1rem' }}>
                <div
                  style={{
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)',
                  }}
                >
                  {group.title}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => {
                        if (window.innerWidth <= 1024) {
                          onClose();
                        }
                      }}
                      style={({ isActive }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.85rem',
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                        backgroundColor: isActive ? 'var(--brand-primary-light)' : 'transparent',
                        textDecoration: 'none',
                        transition: 'background-color var(--transition-fast), color var(--transition-fast)',
                      })}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className="badge badge-info"
                          style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
