import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  AlertTriangle,
  DoorOpen,
  Menu
} from 'lucide-react';

interface BottomNavProps {
  onOpenMenu: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenMenu }) => {
  return (
    <nav className="bottom-nav" aria-label="Mobile Navigation">
      <NavLink
        to="/dashboard"
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <LayoutDashboard size={20} />
        <span>Home</span>
      </NavLink>

      <NavLink
        to="/student/requests"
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <FileText size={20} />
        <span>Requests</span>
      </NavLink>

      <NavLink
        to="/student/complaints"
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <AlertTriangle size={20} />
        <span>Complaints</span>
      </NavLink>

      <NavLink
        to="/student/gate-pass"
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <DoorOpen size={20} />
        <span>Gate Pass</span>
      </NavLink>

      <button
        type="button"
        className="bottom-nav-item"
        onClick={onOpenMenu}
        aria-label="Open full campus menu"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <Menu size={20} />
        <span>More</span>
      </button>
    </nav>
  );
};
