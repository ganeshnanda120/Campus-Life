import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Shield,
  X,
  Plus,
  Edit2,
  Trash2,
  Building,
} from 'lucide-react';
import { Modal } from './Modal';
import { Badge } from './Badge';
import { Button } from './Button';
import { Alert } from './Alert';
import { GrantPermissionModal } from './GrantPermissionModal';
import { useAuth } from '../../context/useAuth';
import { userService } from '../../services/userService';
import {
  ALL_PERMISSIONS,
  PERMISSION_CATEGORIES,
  getUserAssignedBranches,
  getEffectiveScopedPermissions,
  canPerformAction,
  areBranchesEqual,
  canUserDelegatePermission,
} from '../../services/permissionService';
import { degreeProgramService } from '../../services/degreeProgramService';
import type {
  UserRecord,
  UserPermission,
  ScopedPermission,
} from '../../types';

interface PermissionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: UserRecord | null;
  onSavePermissions?: (newPermissions: UserPermission[]) => Promise<boolean | void>;
  onPermissionsUpdated?: () => void;
}

export const PermissionManagerModal: React.FC<PermissionManagerModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onSavePermissions,
  onPermissionsUpdated,
}) => {
  const { userProfile: currentUserProfile, role: currentRole } = useAuth();

  // Local working copy of target user and permissions
  const [activeUser, setActiveUser] = useState<UserRecord | null>(targetUser);
  const [assignedBranches, setAssignedBranches] = useState<string[]>([]);
  const [scopedPermissions, setScopedPermissions] = useState<ScopedPermission[]>([]);

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');

  // Branch management sub-state
  const [isBranchEditorOpen, setIsBranchEditorOpen] = useState(false);
  const [availableSystemBranches, setAvailableSystemBranches] = useState<string[]>([]);
  const [newBranchInput, setNewBranchInput] = useState('');

  // Grant modal sub-state
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [permissionToEdit, setPermissionToEdit] = useState<ScopedPermission | null>(null);

  // Status states
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load available system branches from degree programs
  useEffect(() => {
    degreeProgramService
      .getDegrees()
      .then((degrees) => {
        const branches = new Set<string>(['BCA', 'B.Tech', 'MCA', 'MBA']);
        degrees.forEach((d) => {
          if (d.name) branches.add(d.name);
          (d.branches || []).forEach((b) => branches.add(b));
        });
        setAvailableSystemBranches(Array.from(branches));
      })
      .catch(() => {
        setAvailableSystemBranches(['BCA', 'B.Tech', 'MCA', 'MBA']);
      });
  }, []);

  // Sync state whenever targetUser or modal open state changes
  useEffect(() => {
    if (targetUser && isOpen) {
      setActiveUser(targetUser);
      const branches = getUserAssignedBranches(targetUser);
      setAssignedBranches(branches);

      const effective = getEffectiveScopedPermissions(targetUser);
      setScopedPermissions(effective);

      setSearchQuery('');
      setSelectedCategory('ALL');
      setBranchFilter('ALL');
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsBranchEditorOpen(false);
    }
  }, [targetUser, isOpen]);

  // Handle adding a branch to target user
  const handleAddBranch = async (branchName: string) => {
    const clean = branchName.trim();
    if (!clean || !activeUser) return;
    if (assignedBranches.some((b) => areBranchesEqual(b, clean))) {
      setErrorMessage(`Branch "${clean}" is already assigned to ${activeUser.name}.`);
      return;
    }

    const nextBranches = [...assignedBranches, clean];
    setAssignedBranches(nextBranches);
    setNewBranchInput('');
    setErrorMessage(null);

    // Save branches immediately to user
    try {
      const actor = {
        uid: currentUserProfile?.uid || 'admin',
        name: currentUserProfile?.name || 'Administrator',
        role: currentRole || 'MAIN_ADMIN',
      };
      const res = await userService.updateUserAssignedBranches(activeUser.uid, nextBranches, actor);
      if (res.success && res.user) {
        setActiveUser(res.user);
        setSuccessMessage(`Branch "${clean}" added to ${activeUser.name}.`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update branch assignment.');
    }
  };

  // Handle removing a branch from target user (pruning permissions automatically)
  const handleRemoveBranch = async (branchName: string) => {
    if (!activeUser) return;
    const nextBranches = assignedBranches.filter((b) => !areBranchesEqual(b, branchName));
    setAssignedBranches(nextBranches);

    // Prune permissions that reference this branch
    const nextPermissions = scopedPermissions
      .map((sp) => {
        if (sp.scopeType === 'ALL_ASSIGNED_BRANCHES') return sp;
        return {
          ...sp,
          branchIds: sp.branchIds.filter((b) => !areBranchesEqual(b, branchName)),
        };
      })
      .filter((sp) => sp.scopeType === 'ALL_ASSIGNED_BRANCHES' || sp.branchIds.length > 0);

    setScopedPermissions(nextPermissions);

    try {
      const actor = {
        uid: currentUserProfile?.uid || 'admin',
        name: currentUserProfile?.name || 'Administrator',
        role: currentRole || 'MAIN_ADMIN',
      };
      const res = await userService.updateUserAssignedBranches(activeUser.uid, nextBranches, actor);
      if (res.success && res.user) {
        setActiveUser(res.user);
        setSuccessMessage(`Branch "${branchName}" removed. Permissions automatically updated.`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update branch assignment.');
    }
  };

  // Toggle specific action on a specific branch directly in the matrix
  const handleToggleBranchAction = (permKey: string, branch: string, action: string) => {
    if (!activeUser) return;

    // Delegation check if current user is not MAIN_ADMIN
    if (currentRole !== 'MAIN_ADMIN') {
      const delegationCheck = canUserDelegatePermission(
        currentUserProfile,
        branch,
        permKey,
        [action]
      );
      if (!delegationCheck.allowed) {
        setErrorMessage(delegationCheck.reason || 'Delegation check failed.');
        return;
      }
    }

    setScopedPermissions((prev) => {
      // Find matching permission
      const existingIdx = prev.findIndex((p) => p.permissionId === permKey);

      if (existingIdx === -1) {
        // No permission for this module yet: create new SELECTED_BRANCHES entry with this action on this branch
        return [
          ...prev,
          {
            permissionId: permKey,
            actions: [action],
            scopeType: 'SELECTED_BRANCHES',
            branchIds: [branch],
          },
        ];
      }

      const currentPerm = prev[existingIdx];
      const isCurrentlyAllowed = canPerformAction(
        {
          ...activeUser,
          assignedBranches,
          scopedPermissions: prev,
        },
        permKey,
        branch,
        action
      );

      // If already has permission, we want to revoke this action on this branch
      if (isCurrentlyAllowed) {
        // If ALL_ASSIGNED_BRANCHES, split into SELECTED_BRANCHES for other branches or remove action
        if (currentPerm.scopeType === 'ALL_ASSIGNED_BRANCHES') {
          // If only 1 assigned branch, remove action from actions array
          if (assignedBranches.length <= 1) {
            const nextActions = currentPerm.actions.filter((a) => a !== action);
            if (nextActions.length === 0) {
              return prev.filter((_, idx) => idx !== existingIdx);
            }
            const updated = [...prev];
            updated[existingIdx] = { ...currentPerm, actions: nextActions };
            return updated;
          } else {
            // Convert to SELECTED_BRANCHES without this branch
            const remainingBranches = assignedBranches.filter((b) => !areBranchesEqual(b, branch));
            const updated = [...prev];
            updated[existingIdx] = {
              ...currentPerm,
              scopeType: 'SELECTED_BRANCHES',
              branchIds: remainingBranches,
            };
            return updated;
          }
        } else {
          // SELECTED_BRANCHES
          const remainingBranches = (currentPerm.branchIds || []).filter((b) => !areBranchesEqual(b, branch));
          if (remainingBranches.length === 0) {
            return prev.filter((_, idx) => idx !== existingIdx);
          }
          const updated = [...prev];
          updated[existingIdx] = {
            ...currentPerm,
            branchIds: remainingBranches,
          };
          return updated;
        }
      } else {
        // Grant action on this branch
        const updated = [...prev];
        const nextActions = Array.from(new Set([...currentPerm.actions, action]));
        const nextBranches = Array.from(new Set([...(currentPerm.branchIds || []), branch]));

        // Check if now covers all assigned branches
        const coversAll = assignedBranches.every((ab) =>
          nextBranches.some((nb) => areBranchesEqual(nb, ab))
        );

        updated[existingIdx] = {
          ...currentPerm,
          actions: nextActions,
          scopeType: coversAll ? 'ALL_ASSIGNED_BRANCHES' : 'SELECTED_BRANCHES',
          branchIds: coversAll ? [] : nextBranches,
        };
        return updated;
      }
    });

    setErrorMessage(null);
  };

  // Revoke entire permission module for this user
  const handleRevokePermission = (permKey: string) => {
    setScopedPermissions((prev) => prev.filter((p) => p.permissionId !== permKey));
    setErrorMessage(null);
  };

  // Save permission granted from GrantPermissionModal (preventing duplicate entries)
  const handleSaveFromGrantModal = async (newScopedPerm: ScopedPermission) => {
    setScopedPermissions((prev) => {
      // Find existing entry for this permissionId
      const existingIdx = prev.findIndex((p) => p.permissionId === newScopedPerm.permissionId);

      if (existingIdx !== -1) {
        // Update existing permission record in place without duplicating
        const updated = [...prev];
        updated[existingIdx] = newScopedPerm;
        return updated;
      } else {
        return [...prev, newScopedPerm];
      }
    });

    setSuccessMessage(`Permission "${newScopedPerm.permissionId}" staged.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Save all permissions to backend/Firestore
  const handleSaveAll = async () => {
    if (!activeUser) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const actor = {
        uid: currentUserProfile?.uid || 'admin',
        name: currentUserProfile?.name || 'Administrator',
        role: currentRole || 'MAIN_ADMIN',
      };

      const res = await userService.updateUserScopedPermissions(
        activeUser.uid,
        scopedPermissions,
        actor
      );

      if (!res.success) {
        throw new Error(res.error || 'Failed to save scoped permissions.');
      }

      if (onSavePermissions && res.user?.permissions) {
        await onSavePermissions(res.user.permissions);
      }

      if (onPermissionsUpdated) {
        onPermissionsUpdated();
      }

      setSuccessMessage('Permissions successfully saved and applied in real time.');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save permissions.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter modules based on search and category
  const filteredModules = useMemo(() => {
    return ALL_PERMISSIONS.filter((p) => {
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          p.label.toLowerCase().includes(q) ||
          p.key.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  // Compute coverage metrics
  const activeModulesCount = useMemo(() => {
    const keys = new Set(scopedPermissions.map((sp) => sp.permissionId));
    return keys.size;
  }, [scopedPermissions]);

  if (!targetUser || !activeUser) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Permission & Branch Governance — ${activeUser.name}`}
        size="large"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '80vh', overflowY: 'auto' }}>
          {errorMessage && (
            <Alert variant="danger" title="Error" dismissible onDismiss={() => setErrorMessage(null)}>
              {errorMessage}
            </Alert>
          )}

          {successMessage && (
            <Alert variant="success" title="Success" dismissible onDismiss={() => setSuccessMessage(null)}>
              {successMessage}
            </Alert>
          )}

          {/* Section 16: User Dossier Header */}
          <div
            style={{
              padding: '1.15rem',
              backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
              borderRadius: 'var(--radius-md, 8px)',
              border: '1px solid var(--color-border, #e2e8f0)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-primary, #2563eb)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {activeUser.name.charAt(0)}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-main, #0f172a)' }}>
                      {activeUser.name}
                    </h3>
                    <Badge variant={activeUser.role === 'SUB_ADMIN' ? 'warning' : 'info'}>
                      {activeUser.role}
                    </Badge>
                    <Badge variant={activeUser.isActive ? 'success' : 'danger'}>
                      {activeUser.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--color-text-muted, #64748b)', marginTop: '0.2rem' }}>
                    {activeUser.email}
                    {activeUser.employeeId && ` • ID: ${activeUser.employeeId}`}
                    {activeUser.department && ` • ${activeUser.department}`}
                  </div>
                </div>
              </div>

              {/* Action: Open Grant Permission Modal */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus size={15} />}
                  onClick={() => {
                    setPermissionToEdit(null);
                    setIsGrantModalOpen(true);
                  }}
                  disabled={assignedBranches.length === 0}
                >
                  Grant Permission
                </Button>
              </div>
            </div>

            {/* Section 1: User Assigned Branches Showcase */}
            <div
              style={{
                borderTop: '1px solid var(--color-border, #e2e8f0)',
                paddingTop: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Building size={16} style={{ color: 'var(--color-primary, #2563eb)' }} />
                  <strong style={{ fontSize: '0.85rem', color: 'var(--color-text-main, #0f172a)' }}>
                    Assigned Branches:
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)' }}>
                    ({assignedBranches.length} assigned)
                  </span>
                </div>

                {currentRole === 'MAIN_ADMIN' && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Edit2 size={13} />}
                    onClick={() => setIsBranchEditorOpen(!isBranchEditorOpen)}
                  >
                    {isBranchEditorOpen ? 'Close Branch Editor' : 'Manage Assigned Branches'}
                  </Button>
                )}
              </div>

              {/* Badges of assigned branches */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {assignedBranches.length === 0 ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-danger, #ef4444)', fontWeight: 500 }}>
                    ⚠️ No branches assigned. A user must be assigned to at least one branch to receive permissions.
                  </span>
                ) : (
                  assignedBranches.map((branch) => (
                    <span
                      key={branch}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.25rem 0.6rem',
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--color-border, #cbd5e1)',
                        borderRadius: 'var(--radius-sm, 6px)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: 'var(--color-text-main, #0f172a)',
                      }}
                    >
                      {branch}
                      {currentRole === 'MAIN_ADMIN' && isBranchEditorOpen && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBranch(branch)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-danger, #ef4444)',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title={`Remove ${branch}`}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </span>
                  ))
                )}
              </div>

              {/* Branch Editor Drawer */}
              {isBranchEditorOpen && currentRole === 'MAIN_ADMIN' && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    backgroundColor: '#ffffff',
                    border: '1px dashed var(--color-primary, #2563eb)',
                    borderRadius: 'var(--radius-md, 6px)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted, #64748b)' }}>
                    Add Branch from Institutional Directory or Type Custom:
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {availableSystemBranches
                      .filter((b) => !assignedBranches.some((ab) => areBranchesEqual(ab, b)))
                      .map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => handleAddBranch(b)}
                          style={{
                            padding: '0.3rem 0.65rem',
                            borderRadius: 'var(--radius-sm, 6px)',
                            border: '1px solid var(--color-border, #cbd5e1)',
                            backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <Plus size={12} /> {b}
                        </button>
                      ))}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Or enter custom branch (e.g. MCA, MBA, BCA)..."
                      value={newBranchInput}
                      onChange={(e) => setNewBranchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddBranch(newBranchInput);
                        }
                      }}
                      style={{
                        padding: '0.4rem 0.65rem',
                        borderRadius: 'var(--radius-sm, 6px)',
                        border: '1px solid var(--color-border, #cbd5e1)',
                        fontSize: '0.85rem',
                        flex: 1,
                      }}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => handleAddBranch(newBranchInput)}
                      disabled={!newBranchInput.trim()}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search & Category Filter Toolbar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '220px', maxWidth: '380px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.45rem 0.75rem',
                  borderRadius: 'var(--radius-md, 6px)',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  backgroundColor: '#ffffff',
                  width: '100%',
                }}
              >
                <Search size={16} style={{ color: 'var(--color-text-muted, #64748b)' }} />
                <input
                  type="text"
                  placeholder="Filter permissions by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: 'var(--radius-md, 6px)',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  fontSize: '0.85rem',
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="ALL">All Categories</option>
                {PERMISSION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: 'var(--radius-md, 6px)',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  fontSize: '0.85rem',
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="ALL">All Assigned Branches</option>
                {assignedBranches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 16: Module Grouped Permissions Matrix */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredModules.map((moduleDef) => {
              // Find if user has a scoped permission object for this module
              const activePerm = scopedPermissions.find((sp) => sp.permissionId === moduleDef.key);
              const isModuleActive = Boolean(activePerm && activePerm.actions.length > 0);

              const branchesToDisplay =
                branchFilter === 'ALL'
                  ? assignedBranches
                  : assignedBranches.filter((b) => areBranchesEqual(b, branchFilter));

              return (
                <div
                  key={moduleDef.key}
                  style={{
                    borderRadius: 'var(--radius-md, 8px)',
                    border: `1px solid ${isModuleActive ? 'var(--color-primary, #2563eb)' : 'var(--color-border, #e2e8f0)'}`,
                    backgroundColor: isModuleActive ? '#ffffff' : 'var(--color-bg-secondary, #fafbfc)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Module Header Card */}
                  <div
                    style={{
                      padding: '0.85rem 1rem',
                      backgroundColor: isModuleActive ? 'rgba(37, 99, 235, 0.04)' : '#f8fafc',
                      borderBottom: '1px solid var(--color-border, #e2e8f0)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--color-text-main, #0f172a)' }}>
                          {moduleDef.label}
                        </strong>
                        <Badge variant="neutral">{moduleDef.category}</Badge>
                        {isModuleActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="neutral">Not Granted</Badge>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted, #64748b)', marginTop: '0.2rem' }}>
                        {moduleDef.description}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        leftIcon={<Edit2 size={13} />}
                        onClick={() => {
                          setPermissionToEdit(activePerm || {
                            permissionId: moduleDef.key,
                            actions: moduleDef.defaultActions,
                            scopeType: 'ALL_ASSIGNED_BRANCHES',
                            branchIds: [],
                          });
                          setIsGrantModalOpen(true);
                        }}
                        disabled={assignedBranches.length === 0}
                      >
                        {isModuleActive ? 'Edit Scope' : 'Configure'}
                      </Button>

                      {isModuleActive && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokePermission(moduleDef.key)}
                          style={{ color: 'var(--color-danger, #ef4444)' }}
                          title="Revoke all access to this module"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Section 16 Matrix: Grouped by Assigned Branch */}
                  <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {branchesToDisplay.length === 0 ? (
                      <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted, #64748b)', fontStyle: 'italic' }}>
                        No assigned branches match the current branch filter.
                      </div>
                    ) : (
                      branchesToDisplay.map((branch) => {
                        return (
                          <div
                            key={branch}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.5rem 0.75rem',
                              borderRadius: 'var(--radius-sm, 6px)',
                              backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
                              border: '1px solid var(--color-border, #e2e8f0)',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '120px' }}>
                              <Building size={14} style={{ color: 'var(--color-text-muted, #64748b)' }} />
                              <strong style={{ fontSize: '0.88rem', color: 'var(--color-text-main, #0f172a)' }}>
                                {branch}
                              </strong>
                            </div>

                            {/* Action checkboxes for this branch */}
                            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                              {moduleDef.supportedActions.map((action) => {
                                const hasAction = canPerformAction(
                                  {
                                    ...activeUser,
                                    assignedBranches,
                                    scopedPermissions,
                                  },
                                  moduleDef.key,
                                  branch,
                                  action
                                );

                                return (
                                  <label
                                    key={action}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      fontSize: '0.82rem',
                                      cursor: 'pointer',
                                      color: hasAction ? 'var(--color-primary, #2563eb)' : 'var(--color-text-muted, #64748b)',
                                      fontWeight: hasAction ? 600 : 400,
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={hasAction}
                                      onChange={() =>
                                        handleToggleBranchAction(moduleDef.key, branch, action)
                                      }
                                      style={{ cursor: 'pointer' }}
                                    />
                                    <span>{action.toUpperCase()}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal Footer Controls */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--color-border, #e2e8f0)',
              paddingTop: '1rem',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontSize: '0.84rem', color: 'var(--color-text-muted, #64748b)' }}>
              Active Modules: <strong>{activeModulesCount}</strong> / {ALL_PERMISSIONS.length}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSaveAll}
                disabled={isSaving}
                leftIcon={<Shield size={16} />}
              >
                {isSaving ? 'Saving Changes...' : 'Save & Enforce Permissions'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Grant / Edit Scoped Permission Modal */}
      {isGrantModalOpen && (
        <GrantPermissionModal
          isOpen={isGrantModalOpen}
          onClose={() => {
            setIsGrantModalOpen(false);
            setPermissionToEdit(null);
          }}
          targetUser={activeUser}
          grantorUser={currentUserProfile}
          existingPermission={permissionToEdit}
          onSave={handleSaveFromGrantModal}
        />
      )}
    </>
  );
};
