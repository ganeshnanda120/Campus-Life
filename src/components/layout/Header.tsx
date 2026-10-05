import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Menu,
  Sun,
  Moon,
  Bell,
  Search,
  User as UserIcon,
  GraduationCap,
  LogOut,
  ChevronDown,
  Settings,
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
  userName = 'Ganesh Nanda',
  userRole = 'MAIN_ADMIN',
  onLogout,
}) => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Search state & shortcut
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Profile dropdown state & click outside listener
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/search');
    }
  };

  // Helper for computing initials for avatar fallback
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (name[0] || 'U').toUpperCase();
  };

  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <header
      className="app-header h-16 flex-shrink-0 z-30 flex items-center justify-between px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80"
      style={{
        height: '64px',
        flexShrink: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        backgroundColor: 'var(--header-bg, rgba(255, 255, 255, 0.82))',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default, rgba(226, 232, 240, 0.8))',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* 1. LEFT SECTION: Hamburger button (mobile/tablet only) & Clean Branded Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="header-hamburger-btn hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors lg:hidden"
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md, 8px)',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary, #475569)',
            cursor: 'pointer',
            padding: 0,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle, rgba(0,0,0,0.05))')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Menu size={20} />
        </button>

        <Link
          to="/dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md, 10px)',
              background: 'linear-gradient(135deg, var(--brand-primary, #2563eb) 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
              flexShrink: 0,
            }}
          >
            <GraduationCap size={20} />
          </div>

          <span
            style={{
              fontFamily: 'var(--font-heading, inherit)',
              fontWeight: 700,
              fontSize: '1.1rem',
              lineHeight: 1.2,
              color: 'var(--text-primary, #0f172a)',
              letterSpacing: '-0.01em',
            }}
          >
            Campus Life
          </span>
        </Link>
      </div>

      {/* 2. CENTER SECTION: Integrated Semi-Translucent Pill Search Bar */}
      <div
        className="hide-on-mobile"
        style={{
          flex: '1',
          maxWidth: '440px',
          margin: '0 1.5rem',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <form
          onSubmit={handleSearchSubmit}
          style={{
            width: '100%',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '0.95rem',
              color: 'var(--text-muted, #94a3b8)',
              pointerEvents: 'none',
            }}
          />

          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search students, complaints, passes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: '38px',
              paddingLeft: '2.5rem',
              paddingRight: '4.5rem',
              borderRadius: '9999px',
              backgroundColor: 'var(--search-bg, rgba(241, 245, 249, 0.75))',
              border: '1px solid var(--border-default, rgba(226, 232, 240, 0.8))',
              color: 'var(--text-primary, #0f172a)',
              fontSize: '0.875rem',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'all 0.15s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--brand-primary, #2563eb)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)';
              e.currentTarget.style.backgroundColor = 'var(--bg-surface, #ffffff)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default, rgba(226, 232, 240, 0.8))';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.backgroundColor = 'var(--search-bg, rgba(241, 245, 249, 0.75))';
            }}
          />

          {/* Keyboard shortcut hint pill */}
          <div
            style={{
              position: 'absolute',
              right: '0.65rem',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <kbd
              style={{
                padding: '2px 6px',
                fontSize: '0.7rem',
                fontFamily: 'inherit',
                fontWeight: 600,
                color: 'var(--text-muted, #64748b)',
                backgroundColor: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border-default, #cbd5e1)',
                borderRadius: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              {isMac ? '⌘K' : 'Ctrl+K'}
            </kbd>
          </div>
        </form>
      </div>

      {/* 3. RIGHT SECTION: Borderless Utility Icons, Vertical Divider & Profile Dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {/* Mobile Search Icon Button (visible only on small screens) */}
        <button
          type="button"
          onClick={() => navigate('/search')}
          aria-label="Universal search"
          className="show-on-mobile"
          style={{
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            borderRadius: '9999px',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary, #475569)',
            cursor: 'pointer',
          }}
        >
          <Search size={19} />
        </button>

        {/* Theme Toggle (Moon/Sun) */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          className="hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            borderRadius: '9999px',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary, #475569)',
            cursor: 'pointer',
            padding: 0,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle, rgba(0,0,0,0.05))')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
        </button>

        {/* Notification Bell with Active Indicator Dot */}
        <Link
          to="/notifications"
          aria-label={`Notifications, ${unreadNotificationsCount} unread`}
          title="Notification Center"
          className="hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            borderRadius: '9999px',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary, #475569)',
            cursor: 'pointer',
            position: 'relative',
            textDecoration: 'none',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle, rgba(0,0,0,0.05))')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Bell size={19} />
          {unreadNotificationsCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '9px',
                right: '9px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--status-danger, #ef4444)',
                boxShadow: '0 0 0 2px var(--bg-surface, #ffffff)',
              }}
            />
          )}
        </Link>

        {/* Subtle Vertical Divider */}
        <div
          className="w-[1px] h-6 bg-slate-200"
          style={{
            width: '1px',
            height: '24px',
            backgroundColor: 'var(--border-default, #e2e8f0)',
            margin: '0 0.4rem',
            flexShrink: 0,
          }}
        />

        {/* Unified User Profile Dropdown Trigger */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
            className="hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.35rem 0.65rem',
              borderRadius: 'var(--radius-lg, 12px)',
              border: 'none',
              background: isDropdownOpen ? 'var(--bg-subtle, rgba(0,0,0,0.05))' : 'transparent',
              cursor: 'pointer',
              color: 'inherit',
              transition: 'all 0.15s ease',
            }}
          >
            {/* User Avatar Initials Badge */}
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.8rem',
                letterSpacing: '0.02em',
                flexShrink: 0,
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
              }}
            >
              {getInitials(userName)}
            </div>

            {/* User Name & Role Stack */}
            <div style={{ display: 'none', flexDirection: 'column', textAlign: 'left', lineHeight: 1.2 }} className="d-sm-flex">
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-primary, #0f172a)',
                  whiteSpace: 'nowrap',
                }}
              >
                {userName}
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-muted, #64748b)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginTop: '1px',
                }}
              >
                {userRole}
              </span>
            </div>

            {/* Subtle Chevron-Down */}
            <ChevronDown
              size={15}
              style={{
                color: 'var(--text-muted, #94a3b8)',
                transition: 'transform 0.2s ease',
                transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </button>

          {/* Clean Production-Grade Dropdown Menu */}
          {isDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 8px)',
                width: '230px',
                borderRadius: 'var(--radius-lg, 12px)',
                backgroundColor: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border-default, #e2e8f0)',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                padding: '0.4rem',
                zIndex: 50,
                animation: 'dropdownFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Dropdown Header Info */}
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                  marginBottom: '0.35rem',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary, #0f172a)' }}>
                  {userName}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                  Role: <span style={{ fontWeight: 600, color: 'var(--brand-primary, #2563eb)' }}>{userRole}</span>
                </div>
              </div>

              {/* Menu Items */}
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false);
                  navigate('/profile');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.55rem 0.85rem',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-secondary, #334155)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <UserIcon size={16} style={{ color: 'var(--text-muted, #64748b)' }} />
                <span>My Profile</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false);
                  navigate('/profile');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.55rem 0.85rem',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-secondary, #334155)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Settings size={16} style={{ color: 'var(--text-muted, #64748b)' }} />
                <span>Settings</span>
              </button>

              {/* Divider */}
              <div
                style={{
                  height: '1px',
                  backgroundColor: 'var(--border-subtle, #f1f5f9)',
                  margin: '0.35rem 0',
                }}
              />

              {/* Logout Option */}
              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onLogout();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    borderRadius: 'var(--radius-md, 8px)',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--status-danger, #dc2626)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <LogOut size={16} style={{ color: 'var(--status-danger, #dc2626)' }} />
                  <span>Log out</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
