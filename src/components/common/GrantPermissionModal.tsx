import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Modal } from './Modal';
import { Badge } from './Badge';
import { Button } from './Button';
import { Alert } from './Alert';
import {
  ALL_PERMISSIONS,
  PERMISSION_CATEGORIES,
  getUserAssignedBranches,
  findPermissionDefinition,
  canUserDelegatePermission,
  canPerformAction,
} from '../../services/permissionService';
import type {
  UserRecord,
  ScopedPermission,
  PermissionScopeType,
} from '../../types';

interface GrantPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: UserRecord | null;
  grantorUser: UserRecord | null;
  existingPermission?: ScopedPermission | null;
  onSave: (permission: ScopedPermission) => Promise<boolean | void>;
}

export const GrantPermissionModal: React.FC<GrantPermissionModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  grantorUser,
  existingPermission,
  onSave,
}) => {
  const [selectedPermissionId, setSelectedPermissionId] = useState<string>('student_records');
  const [selectedActions, setSelectedActions] = useState<string[]>(['view']);
  const [scopeType, setScopeType] = useState<PermissionScopeType>('ALL_ASSIGNED_BRANCHES');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // User's currently assigned branches
  const userBranches = useMemo(() => {
    return targetUser ? getUserAssignedBranches(targetUser) : [];
  }, [targetUser]);

  // Selected permission definition
  const currentDef = useMemo(() => {
    return findPermissionDefinition(selectedPermissionId) || ALL_PERMISSIONS[0];
  }, [selectedPermissionId]);

  // Initialize form state when opening or when targetUser/existingPermission changes
  useEffect(() => {
    if (isOpen && targetUser) {
      setValidationError(null);
      if (existingPermission) {
        setSelectedPermissionId(existingPermission.permissionId);
        setSelectedActions(existingPermission.actions || ['view']);
        setScopeType(existingPermission.scopeType);
        setSelectedBranches(
          (existingPermission.branchIds || []).filter((b) => userBranches.includes(b))
        );
      } else {
        const defaultDef = ALL_PERMISSIONS[0];
        setSelectedPermissionId(defaultDef.key);
        setSelectedActions(defaultDef.defaultActions || ['view']);
        setScopeType('ALL_ASSIGNED_BRANCHES');
        setSelectedBranches(userBranches.length > 0 ? [userBranches[0]] : []);
      }
    }
  }, [isOpen, targetUser, existingPermission, userBranches]);

  // When changing permission, adjust default actions
  const handleSelectPermission = (permKey: string) => {
    setSelectedPermissionId(permKey);
    const def = findPermissionDefinition(permKey);
    if (def) {
      setSelectedActions(def.defaultActions || ['view']);
    }
    setValidationError(null);
  };

  // Toggle action selection
  const handleToggleAction = (action: string) => {
    setSelectedActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    );
    setValidationError(null);
  };

  // Toggle branch selection (only from user's assigned branches)
  const handleToggleBranch = (branch: string) => {
    if (!userBranches.includes(branch)) return; // Safety: cannot select unassigned branch
    setSelectedBranches((prev) =>
      prev.includes(branch) ? prev.filter((b) => b !== branch) : [...prev, branch]
    );
    setValidationError(null);
  };

  // Select all assigned branches
  const handleSelectAllBranches = () => {
    setSelectedBranches([...userBranches]);
    setValidationError(null);
  };

  // Clear branch selection
  const handleClearBranches = () => {
    setSelectedBranches([]);
  };

  // Action delegation check helper for current grantor
  const isActionAllowedByGrantor = (action: string, branchToCheck?: string) => {
    if (!grantorUser || grantorUser.role === 'MAIN_ADMIN') return true;
    const branches = branchToCheck
      ? [branchToCheck]
      : scopeType === 'ALL_ASSIGNED_BRANCHES'
      ? userBranches
      : selectedBranches;

    if (branches.length === 0) return true;

    // Grantor must possess this action on all applicable branches
    return branches.every((b) =>
      canPerformAction(grantorUser, currentDef.key, b, action)
    );
  };

  // Validate form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!targetUser) {
      setValidationError('Target user is missing.');
      return;
    }

    if (userBranches.length === 0) {
      setValidationError(
        `User ${targetUser.name} has no assigned branches. Please assign at least one branch to this user before granting branch-scoped permissions.`
      );
      return;
    }

    if (selectedActions.length === 0) {
      setValidationError('Please select at least one action (e.g. View).');
      return;
    }

    if (scopeType === 'SELECTED_BRANCHES') {
      if (selectedBranches.length === 0) {
        setValidationError('Please select at least one branch under Selected Branches.');
        return;
      }
      // Strict validation: cannot select a branch not assigned to user
      const unassigned = selectedBranches.filter((b) => !userBranches.includes(b));
      if (unassigned.length > 0) {
        setValidationError(
          `Cannot grant access to unassigned branches: ${unassigned.join(', ')}.`
        );
        return;
      }
    }

    // Delegation validation for non-MAIN_ADMIN grantor
    if (grantorUser && grantorUser.role !== 'MAIN_ADMIN') {
      const branchesToValidate =
        scopeType === 'ALL_ASSIGNED_BRANCHES' ? userBranches : selectedBranches;

      for (const branch of branchesToValidate) {
        const delegationResult = canUserDelegatePermission(
          grantorUser,
          branch,
          currentDef.key,
          selectedActions
        );
        if (!delegationResult.allowed) {
          setValidationError(delegationResult.reason || 'Delegation check failed.');
          return;
        }
      }
    }

    const scopedPerm: ScopedPermission = {
      permissionId: currentDef.key,
      actions: selectedActions,
      scopeType,
      branchIds: scopeType === 'SELECTED_BRANCHES' ? selectedBranches : [],
    };

    setIsSubmitting(true);
    try {
      await onSave(scopedPerm);
      onClose();
    } catch (err: any) {
      setValidationError(err?.message || 'Failed to grant permission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!targetUser) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={existingPermission ? 'Edit Branch-Scoped Permission' : 'Grant Permission'}
      size="large"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {validationError && (
          <Alert variant="danger" title="Validation Error" dismissible onDismiss={() => setValidationError(null)}>
            {validationError}
          </Alert>
        )}

        {/* User Context Dossier Header */}
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Target User:
                </span>
                <strong style={{ fontSize: '1rem', color: 'var(--color-text-main, #0f172a)' }}>
                  {targetUser.name}
                </strong>
                <Badge variant={targetUser.role === 'SUB_ADMIN' ? 'warning' : 'info'}>
                  {targetUser.role}
                </Badge>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted, #64748b)', marginTop: '0.15rem' }}>
                {targetUser.email}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted, #64748b)' }}>
                Assigned Branches ({userBranches.length}):
              </span>
              {userBranches.length === 0 ? (
                <Badge variant="danger">No Branches Assigned</Badge>
              ) : (
                userBranches.map((b) => (
                  <Badge key={b} variant="neutral">
                    {b}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Step 1: Select Permission Module */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
            Step 1: Select Permission Module <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span>
          </label>
          <select
            value={selectedPermissionId}
            onChange={(e) => handleSelectPermission(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-md, 6px)',
              border: '1px solid var(--color-border, #cbd5e1)',
              backgroundColor: 'var(--color-bg-surface, #ffffff)',
              fontSize: '0.9rem',
              color: 'var(--color-text-main, #0f172a)',
            }}
          >
            {PERMISSION_CATEGORIES.map((cat) => (
              <optgroup key={cat} label={cat}>
                {ALL_PERMISSIONS.filter((p) => p.category === cat).map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label} — ({p.description.slice(0, 50)}...)
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)' }}>
            {currentDef.description}
          </p>
        </div>

        {/* Step 2: Select Actions (Action-Level Permissions) */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
            Step 2: Select Actions <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span>
          </label>
          <div
            style={{
              display: 'flex',
              gap: '0.6rem',
              flexWrap: 'wrap',
              padding: '0.75rem',
              backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
              borderRadius: 'var(--radius-md, 6px)',
              border: '1px solid var(--color-border, #e2e8f0)',
            }}
          >
            {currentDef.supportedActions.map((action) => {
              const isChecked = selectedActions.includes(action);
              const isAllowedByGrantor = isActionAllowedByGrantor(action);
              const label = action.replace(/_/g, ' ').toUpperCase();

              return (
                <label
                  key={action}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.45rem 0.75rem',
                    borderRadius: 'var(--radius-sm, 6px)',
                    border: `1px solid ${isChecked ? 'var(--color-primary, #2563eb)' : 'var(--color-border, #cbd5e1)'}`,
                    backgroundColor: isChecked ? 'rgba(37, 99, 235, 0.08)' : '#ffffff',
                    cursor: isAllowedByGrantor ? 'pointer' : 'not-allowed',
                    opacity: isAllowedByGrantor ? 1 : 0.5,
                    fontSize: '0.85rem',
                    fontWeight: isChecked ? 600 : 500,
                  }}
                  title={!isAllowedByGrantor ? 'Delegator does not possess this action to grant.' : ''}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={!isAllowedByGrantor}
                    onChange={() => handleToggleAction(action)}
                    style={{ cursor: isAllowedByGrantor ? 'pointer' : 'not-allowed' }}
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Step 3: Select Branch Scope */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
            Step 3: Branch Scope <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input
                type="radio"
                name="branchScopeType"
                value="ALL_ASSIGNED_BRANCHES"
                checked={scopeType === 'ALL_ASSIGNED_BRANCHES'}
                onChange={() => {
                  setScopeType('ALL_ASSIGNED_BRANCHES');
                  setValidationError(null);
                }}
              />
              <span>All Assigned Branches ({userBranches.length})</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input
                type="radio"
                name="branchScopeType"
                value="SELECTED_BRANCHES"
                checked={scopeType === 'SELECTED_BRANCHES'}
                onChange={() => {
                  setScopeType('SELECTED_BRANCHES');
                  setValidationError(null);
                }}
              />
              <span>Selected Branches</span>
            </label>
          </div>

          {/* Step 4: If Selected Branches, display checklist containing ONLY assigned branches */}
          {scopeType === 'SELECTED_BRANCHES' && (
            <div
              style={{
                border: '1px solid var(--color-border, #e2e8f0)',
                borderRadius: 'var(--radius-md, 8px)',
                padding: '0.85rem',
                backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted, #64748b)' }}>
                  Checklist (Contains ONLY assigned branches for {targetUser.name}):
                </span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={handleSelectAllBranches}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary, #2563eb)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Select All
                  </button>
                  <span style={{ color: 'var(--color-border, #cbd5e1)' }}>•</span>
                  <button
                    type="button"
                    onClick={handleClearBranches}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-danger, #ef4444)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {userBranches.length === 0 ? (
                <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--color-danger, #ef4444)', fontSize: '0.85rem' }}>
                  No branches currently assigned to this user. Please assign branches first.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '0.5rem',
                  }}
                >
                  {userBranches.map((branch) => {
                    const isChecked = selectedBranches.includes(branch);
                    return (
                      <label
                        key={branch}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-sm, 6px)',
                          border: `1px solid ${isChecked ? 'var(--color-primary, #2563eb)' : 'var(--color-border, #cbd5e1)'}`,
                          backgroundColor: isChecked ? 'rgba(37, 99, 235, 0.08)' : '#ffffff',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: isChecked ? 600 : 500,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleBranch(branch)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>{branch}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 5: Permission Summary Pill */}
        <div
          style={{
            padding: '0.85rem 1rem',
            backgroundColor: 'rgba(37, 99, 235, 0.05)',
            border: '1px solid rgba(37, 99, 235, 0.2)',
            borderRadius: 'var(--radius-md, 8px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-primary, #2563eb)', textTransform: 'uppercase' }}>
            Permission Summary:
          </div>
          <div style={{ fontSize: '0.88rem', color: 'var(--color-text-main, #0f172a)' }}>
            <strong>Permission:</strong> {currentDef.label}
          </div>
          <div style={{ fontSize: '0.88rem', color: 'var(--color-text-main, #0f172a)' }}>
            <strong>Actions:</strong> {selectedActions.length > 0 ? selectedActions.join(', ') : 'None selected'}
          </div>
          <div style={{ fontSize: '0.88rem', color: 'var(--color-text-main, #0f172a)' }}>
            <strong>Branches:</strong>{' '}
            {scopeType === 'ALL_ASSIGNED_BRANCHES'
              ? `All Assigned Branches (${userBranches.join(', ') || 'None'})`
              : selectedBranches.join(', ') || 'None selected'}
          </div>
        </div>

        {/* Action Controls */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            borderTop: '1px solid var(--color-border, #e2e8f0)',
            paddingTop: '1rem',
          }}
        >
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || userBranches.length === 0}
            leftIcon={<ShieldCheck size={16} />}
          >
            {isSubmitting
              ? 'Saving...'
              : existingPermission
              ? 'Update Permission'
              : 'Grant Permission'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
