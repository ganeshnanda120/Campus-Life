import React from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import type { UserRole, UserPermission } from '../types';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../components/common/Button';
import {
  canPerformAction,
  getAccessibleBranches,
  findPermissionDefinition,
} from '../services/permissionService';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: UserPermission | string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requiredPermission,
}) => {
  const { isAuthenticated, isLoading, role, userProfile } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // URL branch & action query parameters (Section 23: Security against manual URL access)
  const urlBranch = searchParams.get('branch');
  const urlAction = searchParams.get('action') || 'view';

  // Section 30: Loading state guard
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
          Loading permissions...
        </span>
      </div>
    );
  }

  // Section 17: Redirect unauthenticated users
  if (!isAuthenticated || !userProfile) {
    let isLoggedOut = false;
    try {
      isLoggedOut = sessionStorage.getItem('campus_life_logged_out') === 'true';
    } catch {
      // ignore
    }
    return <Navigate to="/login" state={isLoggedOut ? { isLogout: true } : { from: location }} replace />;
  }

  // Section 23: Branch-Scoped URL Protection
  if (requiredPermission && role !== 'MAIN_ADMIN') {
    const permDef = findPermissionDefinition(requiredPermission);
    let permKey = permDef ? permDef.key : requiredPermission;
    if (requiredPermission === 'MANAGE_SUB_ADMINS') {
      const hasSubAdmin = getAccessibleBranches(userProfile, 'MANAGE_SUB_ADMINS', urlAction).length > 0;
      const hasGrant = getAccessibleBranches(userProfile, 'CAN_GRANT_PERMISSIONS', urlAction).length > 0;
      if (!hasSubAdmin && hasGrant) {
        permKey = 'grant_permissions';
      }
    }

    // 1. If a specific branch is requested in the URL query string:
    if (urlBranch && urlBranch.trim() && urlBranch !== 'ALL') {
      const isBranchAllowed = canPerformAction(userProfile, permKey, urlBranch, urlAction);
      if (!isBranchAllowed) {
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
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--status-danger)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  <ShieldAlert size={30} />
                </div>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Branch Access Denied</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  You don't have permission to access this branch ({urlBranch}).
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <Button variant="primary" onClick={() => window.history.back()}>
                    Return
                  </Button>
                  <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
                    Dashboard
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      }
    } else {
      // 2. If no branch in URL, check if user has access to at least one branch for this module
      const accessibleBranches = getAccessibleBranches(userProfile, permKey, urlAction);
      if (accessibleBranches.length === 0) {
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
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--status-danger)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  <ShieldAlert size={30} />
                </div>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Permission Denied</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  You don't have permission to perform this action.
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
  }

  // Role guard validation if requiredPermission was not specified
  if (!requiredPermission && allowedRoles && role && !allowedRoles.includes(role)) {
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
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
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

  return <>{children}</>;
};
