import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import type { UserRole, UserPermission } from '../types';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../components/common/Button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: UserPermission;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requiredPermission,
}) => {
  const { isAuthenticated, isLoading, role, permissions } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
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
          Verifying authorized session...
        </span>
      </div>
    );
  }

  // Section 17: Redirect unauthenticated users
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Section 18: Role guard validation
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return (
      <div
        style={{
          padding: '2.5rem 1.5rem',
          maxWidth: '560px',
          margin: '2rem auto',
          textAlign: 'center',
        }}
      >
        <div className="card">
          <div className="card-body" style={{ padding: '2rem' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--status-danger-bg)',
                color: 'var(--status-danger)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <ShieldAlert size={30} />
            </div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Access Restricted</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Your assigned institutional role (<code>{role}</code>) does not have authorization
              to access this management module.
            </p>
            <Button variant="primary" onClick={() => window.history.back()}>
              Go Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Granular Sub-Admin permission check (Section 12 & 18)
  if (requiredPermission && role === 'SUB_ADMIN') {
    const hasPerm = permissions.includes(requiredPermission);
    if (!hasPerm) {
      return (
        <div
          style={{
            padding: '2.5rem 1.5rem',
            maxWidth: '560px',
            margin: '2rem auto',
            textAlign: 'center',
          }}
        >
          <div className="card">
            <div className="card-body" style={{ padding: '2rem' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--status-warning-bg)',
                  color: 'var(--status-warning)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                }}
              >
                <ShieldAlert size={30} />
              </div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Permission Required</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                You require the <code>{requiredPermission}</code> permission from the Main Administrator
                to perform operations in this section.
              </p>
              <Button variant="primary" onClick={() => window.history.back()}>
                Return
              </Button>
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};
