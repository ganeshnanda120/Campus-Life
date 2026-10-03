import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Menu,
  Sun,
  Moon,
  Bell,
  Search,
  User as UserIcon,
  GraduationCap,
  LogOut
} from 'lucide-react';
import { useTheme } from '../../context/useTheme';

interface HeaderProps {
  onToggleSidebar: () => void;
  unreadNotificationsCount?: number;
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  unreadNotificationsCount = 3,
  userName = 'Campus User',
  userRole = 'STUDENT',
  onLogout,
}) => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
        <button
          type="button"
          className="btn-ghost btn-icon"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          style={{ display: 'flex' }}
        >
          <Menu size={20} />
        </button>

        <Link
          to="/dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0,
            }}
          >
            <GraduationCap size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                fontSize: '1.05rem',
                lineHeight: 1.1,
                color: 'var(--text-primary)',
              }}
            >
              Campus Life
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              BPUT Operations
            </span>
          </div>
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        {/* Search quick access */}
        <button
          type="button"
          className="btn-ghost btn-icon"
          onClick={() => navigate('/search')}
          aria-label="Search campus records"
          title="Universal Search"
        >
          <Search size={19} />
        </button>

        {/* Dark/Light mode toggle */}
        <button
          type="button"
          className="btn-ghost btn-icon"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
        </button>

        {/* Bell Notification Center */}
        <Link
          to="/notifications"
          className="btn-ghost btn-icon"
          aria-label={`Notifications, ${unreadNotificationsCount} unread`}
          title="Notification Center"
          style={{ position: 'relative' }}
        >
          <Bell size={19} />
          {unreadNotificationsCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 17,
                height: 17,
                borderRadius: '50%',
                backgroundColor: 'var(--status-danger)',
                color: '#ffffff',
                fontSize: '0.65rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--bg-surface)',
              }}
            >
              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
            </span>
          )}
        </Link>

        {/* User Profile Chip */}
        <Link
          to="/profile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '4px 8px',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
            color: 'inherit',
          }}
          className="btn-ghost"
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--brand-primary-light)',
              color: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            <UserIcon size={16} />
          </div>
          <div style={{ display: 'none', flexDirection: 'column', textAlign: 'left' }} className="d-sm-flex">
            <span style={{ fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>{userName}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{userRole}</span>
          </div>
        </Link>

        {/* Sign Out Button */}
        {onLogout && (
          <button
            type="button"
            className="btn-ghost btn-icon"
            onClick={onLogout}
            aria-label="Sign out of Campus Life"
            title="Sign Out"
            style={{ color: 'var(--status-danger-text)' }}
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </header>
  );
};
