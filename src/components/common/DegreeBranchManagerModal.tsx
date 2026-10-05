import React, { useState, useEffect } from 'react';
import {
  Edit2,
  Trash2,
  Plus,
  AlertTriangle,
  GraduationCap,
  GitBranch,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Alert } from './Alert';
import {
  degreeProgramService,
  subscribeDegrees,
} from '../../services/degreeProgramService';
import type { DegreeProgram } from '../../types';

export interface DegreeBranchManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: string;
  currentUserId?: string;
  currentUserName?: string;
  initialDegreeName?: string;
}

type SubModalState =
  | null
  | { type: 'ADD_DEGREE' }
  | { type: 'EDIT_DEGREE'; degree: DegreeProgram }
  | { type: 'ADD_BRANCH'; degreeName: string }
  | { type: 'EDIT_BRANCH'; degreeName: string; branchName: string }
  | {
      type: 'DELETE_DEGREE_CHOICE';
      degree: DegreeProgram;
      studentsCount: number;
      facultyCount: number;
    }
  | {
      type: 'DELETE_DEGREE_CONFIRM_CASCADE';
      degree: DegreeProgram;
      studentsCount: number;
      facultyCount: number;
    }
  | { type: 'DELETE_DEGREE_CONFIRM_SIMPLE'; degree: DegreeProgram }
  | {
      type: 'DELETE_BRANCH_CHOICE';
      degreeName: string;
      branchName: string;
      studentsCount: number;
      facultyCount: number;
    }
  | {
      type: 'DELETE_BRANCH_CONFIRM_CASCADE';
      degreeName: string;
      branchName: string;
      studentsCount: number;
      facultyCount: number;
    }
  | { type: 'DELETE_BRANCH_CONFIRM_SIMPLE'; degreeName: string; branchName: string };

export const DegreeBranchManagerModal: React.FC<DegreeBranchManagerModalProps> = ({
  isOpen,
  onClose,
  currentUserRole = 'MAIN_ADMIN',
  currentUserId = 'admin',
  currentUserName = 'Administrator',
  initialDegreeName,
}) => {
  const [degrees, setDegrees] = useState<DegreeProgram[]>([]);
  const [selectedDegreeName, setSelectedDegreeName] = useState<string>('');
  const [subModal, setSubModal] = useState<SubModalState>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states for Add/Edit Degree
  const [degreeNameInput, setDegreeNameInput] = useState<string>('');
  const [customDurationInput, setCustomDurationInput] = useState<string>('');
  const [durationOption, setDurationOption] = useState<'1' | '2' | '3' | '4' | '5' | 'custom'>('4');
  const [initialBranchInput, setInitialBranchInput] = useState<string>('');

  // Form states for Add/Edit Branch
  const [branchNameInput, setBranchNameInput] = useState<string>('');

  const actor = {
    uid: currentUserId,
    name: currentUserName,
    role: currentUserRole,
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Subscribe to realtime degree changes
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = subscribeDegrees((list) => {
      setDegrees(list);
      if (list.length > 0) {
        setSelectedDegreeName((prev) => {
          if (prev && list.some((d) => d.name === prev)) return prev;
          if (initialDegreeName && list.some((d) => d.name === initialDegreeName)) return initialDegreeName;
          return list[0].name;
        });
      } else {
        setSelectedDegreeName('');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, initialDegreeName]);

  const selectedDegree = degrees.find(
    (d) => d.name.toLowerCase() === selectedDegreeName.toLowerCase()
  );

  // --------------------------------------------------------------------------
  // DEGREE EDIT HANDLERS
  // --------------------------------------------------------------------------
  const openEditDegree = (degree: DegreeProgram) => {
    setOperationError(null);
    setDegreeNameInput(degree.name);
    const durStr = String(degree.durationYears);
    if (['1', '2', '3', '4', '5'].includes(durStr)) {
      setDurationOption(durStr as any);
      setCustomDurationInput('');
    } else {
      setDurationOption('custom');
      setCustomDurationInput(durStr);
    }
    setSubModal({ type: 'EDIT_DEGREE', degree });
  };

  const handleSaveEditDegree = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subModal || subModal.type !== 'EDIT_DEGREE') return;

    const cleanName = degreeNameInput.trim();
    if (!cleanName) {
      setOperationError('Degree / Program Name is required.');
      return;
    }

    let durationNum = 4;
    if (durationOption === 'custom') {
      durationNum = Number(customDurationInput.trim());
      if (!Number.isInteger(durationNum) || durationNum <= 0) {
        setOperationError('Duration must be a positive integer greater than 0.');
        return;
      }
    } else {
      durationNum = Number(durationOption);
    }

    setIsLoading(true);
    setOperationError(null);
    try {
      const res = await degreeProgramService.editDegree(
        subModal.degree.name,
        cleanName,
        durationNum,
        actor
      );

      if (!res.success) {
        setOperationError(res.error || 'Failed to update degree.');
        setIsLoading(false);
        return;
      }

      showToast(`Degree "${cleanName}" updated successfully.`);
      setSelectedDegreeName(cleanName);
      setSubModal(null);
    } catch (err: any) {
      setOperationError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // DEGREE ADD HANDLERS
  // --------------------------------------------------------------------------
  const openAddDegree = () => {
    setOperationError(null);
    setDegreeNameInput('');
    setDurationOption('4');
    setCustomDurationInput('');
    setInitialBranchInput('');
    setSubModal({ type: 'ADD_DEGREE' });
  };

  const handleCreateDegree = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = degreeNameInput.trim();
    if (!cleanName) {
      setOperationError('Degree / Program Name is required.');
      return;
    }

    let durationNum = 4;
    if (durationOption === 'custom') {
      durationNum = Number(customDurationInput.trim());
      if (!Number.isInteger(durationNum) || durationNum <= 0) {
        setOperationError('Duration must be a positive integer greater than 0.');
        return;
      }
    } else {
      durationNum = Number(durationOption);
    }

    setIsLoading(true);
    setOperationError(null);
    try {
      const res = await degreeProgramService.addDegree(cleanName, durationNum, actor);
      if (!res.success || !res.degree) {
        setOperationError(res.error || 'Failed to add degree.');
        setIsLoading(false);
        return;
      }

      if (initialBranchInput.trim()) {
        await degreeProgramService.addBranch(cleanName, initialBranchInput.trim(), actor);
      }

      showToast(`Degree "${cleanName}" (${durationNum} Years) created successfully.`);
      setSelectedDegreeName(cleanName);
      setSubModal(null);
    } catch (err: any) {
      setOperationError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // DEGREE DELETE FLOW
  // --------------------------------------------------------------------------
  const handleInitiateDeleteDegree = async (degree: DegreeProgram) => {
    setOperationError(null);
    setIsLoading(true);
    try {
      const counts = await degreeProgramService.getAffectedCounts(degree.name);
      setIsLoading(false);

      if (counts.studentsCount === 0 && counts.facultyCount === 0) {
        // Simple confirmation
        setSubModal({ type: 'DELETE_DEGREE_CONFIRM_SIMPLE', degree });
      } else {
        // Show choice modal (Option 1 vs Option 2)
        setSubModal({
          type: 'DELETE_DEGREE_CHOICE',
          degree,
          studentsCount: counts.studentsCount,
          facultyCount: counts.facultyCount,
        });
      }
    } catch (err: any) {
      setIsLoading(false);
      setOperationError(err.message || 'Failed to inspect records.');
    }
  };

  const handleExecuteDeleteDegree = async (
    degree: DegreeProgram,
    mode: 'CONFIG_ONLY' | 'CASCADE'
  ) => {
    setIsLoading(true);
    setOperationError(null);
    try {
      const res = await degreeProgramService.deleteDegree(degree.name, mode, actor);
      if (!res.success) {
        setOperationError(res.error || 'Failed to delete degree.');
        setIsLoading(false);
        return;
      }

      if (mode === 'CASCADE') {
        showToast(
          `Degree "${degree.name}" and ${res.deletedStudentsCount || 0} students & ${
            res.deletedFacultyCount || 0
          } faculty permanently deleted.`
        );
      } else {
        showToast(`Degree "${degree.name}" deleted. Existing student and faculty data preserved.`);
      }

      setSubModal(null);
    } catch (err: any) {
      setOperationError(err.message || 'An error occurred during deletion.');
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // BRANCH ADD / EDIT HANDLERS
  // --------------------------------------------------------------------------
  const openAddBranch = (degreeName: string) => {
    setOperationError(null);
    setBranchNameInput('');
    setSubModal({ type: 'ADD_BRANCH', degreeName });
  };

  const handleSaveAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subModal || subModal.type !== 'ADD_BRANCH') return;

    const cleanBranch = branchNameInput.trim();
    if (!cleanBranch) {
      setOperationError('Branch Name is required.');
      return;
    }

    setIsLoading(true);
    setOperationError(null);
    try {
      const res = await degreeProgramService.addBranch(
        subModal.degreeName,
        cleanBranch,
        actor
      );
      if (!res.success) {
        setOperationError(res.error || 'Failed to add branch.');
        setIsLoading(false);
        return;
      }

      showToast(`Branch "${cleanBranch}" added to ${subModal.degreeName}.`);
      setSubModal(null);
    } catch (err: any) {
      setOperationError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditBranch = (degreeName: string, branchName: string) => {
    setOperationError(null);
    setBranchNameInput(branchName);
    setSubModal({ type: 'EDIT_BRANCH', degreeName, branchName });
  };

  const handleSaveEditBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subModal || subModal.type !== 'EDIT_BRANCH') return;

    const cleanBranch = branchNameInput.trim();
    if (!cleanBranch) {
      setOperationError('Branch Name is required.');
      return;
    }

    setIsLoading(true);
    setOperationError(null);
    try {
      const res = await degreeProgramService.editBranch(
        subModal.degreeName,
        subModal.branchName,
        cleanBranch,
        actor
      );
      if (!res.success) {
        setOperationError(res.error || 'Failed to rename branch.');
        setIsLoading(false);
        return;
      }

      showToast(`Branch renamed to "${cleanBranch}".`);
      setSubModal(null);
    } catch (err: any) {
      setOperationError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // BRANCH DELETE FLOW
  // --------------------------------------------------------------------------
  const handleInitiateDeleteBranch = async (degreeName: string, branchName: string) => {
    setOperationError(null);
    setIsLoading(true);
    try {
      const counts = await degreeProgramService.getAffectedCounts(degreeName, branchName);
      setIsLoading(false);

      if (counts.studentsCount === 0 && counts.facultyCount === 0) {
        setSubModal({
          type: 'DELETE_BRANCH_CONFIRM_SIMPLE',
          degreeName,
          branchName,
        });
      } else {
        setSubModal({
          type: 'DELETE_BRANCH_CHOICE',
          degreeName,
          branchName,
          studentsCount: counts.studentsCount,
          facultyCount: counts.facultyCount,
        });
      }
    } catch (err: any) {
      setIsLoading(false);
      setOperationError(err.message || 'Failed to inspect records.');
    }
  };

  const handleExecuteDeleteBranch = async (
    degreeName: string,
    branchName: string,
    mode: 'CONFIG_ONLY' | 'CASCADE'
  ) => {
    setIsLoading(true);
    setOperationError(null);
    try {
      const res = await degreeProgramService.deleteBranch(
        degreeName,
        branchName,
        mode,
        actor
      );
      if (!res.success) {
        setOperationError(res.error || 'Failed to delete branch.');
        setIsLoading(false);
        return;
      }

      if (mode === 'CASCADE') {
        showToast(
          `Branch "${branchName}" and ${res.deletedStudentsCount || 0} students & ${
            res.deletedFacultyCount || 0
          } faculty deleted.`
        );
      } else {
        showToast(`Branch "${branchName}" deleted. Existing student and faculty data preserved.`);
      }

      setSubModal(null);
    } catch (err: any) {
      setOperationError(err.message || 'An error occurred during deletion.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* ===================================================================== */}
      {/* MAIN MANAGER MODAL                                                    */}
      {/* ===================================================================== */}
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Manage Degrees / Programs & Branches"
        size="large"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header notification / banner */}
          {toastMessage && (
            <Alert variant="success" dismissible onDismiss={() => setToastMessage(null)}>
              {toastMessage}
            </Alert>
          )}

          {operationError && !subModal && (
            <Alert variant="danger" dismissible onDismiss={() => setOperationError(null)}>
              {operationError}
            </Alert>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-border, #e2e8f0)',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text, #1e293b)' }}>
                Shared Academic Configuration
              </span>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted, #64748b)' }}>
                Configured degrees and branches are automatically shared between Student and Faculty Management.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={openAddDegree}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Plus size={15} />
              <span>Add New Degree</span>
            </Button>
          </div>

          {/* TWO-COLUMN LAYOUT: DEGREES ON LEFT, BRANCHES ON RIGHT */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.25rem',
              minHeight: '380px',
            }}
          >
            {/* COLUMN 1: DEGREE / PROGRAM LIST */}
            <div
              style={{
                border: '1px solid var(--color-border, #e2e8f0)',
                borderRadius: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                backgroundColor: '#ffffff',
              }}
            >
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
                  borderBottom: '1px solid var(--color-border, #e2e8f0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <GraduationCap size={16} color="var(--brand-primary, #2563eb)" />
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text, #1e293b)' }}>
                    Degrees / Programs ({degrees.length})
                  </span>
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  maxHeight: '420px',
                  padding: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                {degrees.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                    <BookOpen size={28} style={{ opacity: 0.4, margin: '0 auto 0.5rem' }} />
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>No degrees configured yet.</p>
                  </div>
                ) : (
                  degrees.map((deg) => {
                    const isSelected =
                      selectedDegree?.name.toLowerCase() === deg.name.toLowerCase();
                    return (
                      <div
                        key={deg.id || deg.name}
                        onClick={() => setSelectedDegreeName(deg.name)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.375rem',
                          border: isSelected
                            ? '1.5px solid #2563eb'
                            : '1px solid var(--color-border, #e2e8f0)',
                          backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          gap: '0.5rem',
                        }}
                      >
                        {/* Degree info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                color: isSelected ? '#1d4ed8' : '#1e293b',
                                wordBreak: 'break-word',
                              }}
                            >
                              {deg.name}
                            </span>
                            <ChevronRight
                              size={14}
                              style={{
                                opacity: isSelected ? 1 : 0.3,
                                color: isSelected ? '#2563eb' : '#94a3b8',
                              }}
                            />
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: '#64748b',
                              marginTop: '2px',
                            }}
                          >
                            {deg.durationYears} {deg.durationYears === 1 ? 'Year' : 'Years'} •{' '}
                            {deg.branches.length}{' '}
                            {deg.branches.length === 1 ? 'Branch' : 'Branches'}
                          </div>
                        </div>

                        {/* Actions: Edit & Delete on same row */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            flexShrink: 0,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDegree(deg)}
                            title={`Edit ${deg.name}`}
                            aria-label={`Edit ${deg.name}`}
                            style={{
                              padding: '0.3rem 0.55rem',
                              fontSize: '0.78rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              color: '#2563eb',
                            }}
                          >
                            <Edit2 size={13} />
                            <span>Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleInitiateDeleteDegree(deg)}
                            title={`Delete ${deg.name}`}
                            aria-label={`Delete ${deg.name}`}
                            style={{
                              padding: '0.3rem 0.55rem',
                              fontSize: '0.78rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              color: '#dc2626',
                            }}
                          >
                            <Trash2 size={13} />
                            <span>Delete</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* COLUMN 2: BRANCH LIST FOR SELECTED DEGREE */}
            <div
              style={{
                border: '1px solid var(--color-border, #e2e8f0)',
                borderRadius: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                backgroundColor: '#ffffff',
              }}
            >
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
                  borderBottom: '1px solid var(--color-border, #e2e8f0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.4rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <GitBranch size={16} color="var(--brand-primary, #2563eb)" />
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text, #1e293b)' }}>
                    {selectedDegree ? `${selectedDegree.name} Branches` : 'Branches'} (
                    {selectedDegree?.branches.length || 0})
                  </span>
                </div>
                {selectedDegree && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openAddBranch(selectedDegree.name)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.78rem',
                    }}
                  >
                    <Plus size={14} />
                    <span>Add Branch</span>
                  </Button>
                )}
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  maxHeight: '420px',
                  padding: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                {!selectedDegree ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>Select a degree to view its branches.</p>
                  </div>
                ) : selectedDegree.branches.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                    <GitBranch size={26} style={{ opacity: 0.4, margin: '0 auto 0.5rem' }} />
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>
                      No branches configured under {selectedDegree.name}.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => openAddBranch(selectedDegree.name)}
                      style={{ marginTop: '0.75rem', fontSize: '0.78rem' }}
                    >
                      <Plus size={13} style={{ marginRight: '0.25rem' }} />
                      Add First Branch
                    </Button>
                  </div>
                ) : (
                  selectedDegree.branches.map((branch) => (
                    <div
                      key={branch}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--color-border, #e2e8f0)',
                        backgroundColor: '#ffffff',
                        gap: '0.5rem',
                      }}
                    >
                      {/* Branch Name */}
                      <span
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          color: '#1e293b',
                          flex: 1,
                          minWidth: 0,
                          wordBreak: 'break-word',
                        }}
                      >
                        {branch}
                      </span>

                      {/* Actions: Edit & Delete on same row */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          flexShrink: 0,
                        }}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditBranch(selectedDegree.name, branch)}
                          title={`Edit Branch ${branch}`}
                          aria-label={`Edit Branch ${branch}`}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.76rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            color: '#2563eb',
                          }}
                        >
                          <Edit2 size={12} />
                          <span>Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleInitiateDeleteBranch(selectedDegree.name, branch)}
                          title={`Delete Branch ${branch}`}
                          aria-label={`Delete Branch ${branch}`}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.76rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            color: '#dc2626',
                          }}
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              paddingTop: '0.5rem',
              borderTop: '1px solid var(--color-border, #e2e8f0)',
            }}
          >
            <Button variant="secondary" onClick={onClose}>
              Done / Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* ===================================================================== */}
      {/* SUB-MODAL: ADD DEGREE                                                 */}
      {/* ===================================================================== */}
      {subModal?.type === 'ADD_DEGREE' && (
        <Modal
          isOpen={true}
          onClose={() => setSubModal(null)}
          title="Add New Degree / Program"
        >
          <form onSubmit={handleCreateDegree} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {operationError && (
              <Alert variant="danger" dismissible onDismiss={() => setOperationError(null)}>
                {operationError}
              </Alert>
            )}

            <div>
              <label className="input-label" htmlFor="manager-new-degree-name">
                Degree / Program Name *
              </label>
              <input
                id="manager-new-degree-name"
                type="text"
                required
                className="input-field"
                placeholder="e.g. BCA, MBA, MCA, M.Tech"
                value={degreeNameInput}
                onChange={(e) => setDegreeNameInput(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label className="input-label">Duration *</label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                {(['1', '2', '3', '4', '5'] as const).map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setDurationOption(yr)}
                    style={{
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderRadius: '0.375rem',
                      border: durationOption === yr ? '1px solid #2563eb' : '1px solid #cbd5e1',
                      backgroundColor: durationOption === yr ? '#eff6ff' : '#ffffff',
                      color: durationOption === yr ? '#1d4ed8' : '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    {yr} {yr === '1' ? 'Year' : 'Years'}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setDurationOption('custom')}
                  style={{
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    borderRadius: '0.375rem',
                    border: durationOption === 'custom' ? '1px solid #2563eb' : '1px solid #cbd5e1',
                    backgroundColor: durationOption === 'custom' ? '#eff6ff' : '#ffffff',
                    color: durationOption === 'custom' ? '#1d4ed8' : '#334155',
                    cursor: 'pointer',
                  }}
                >
                  Custom
                </button>
              </div>

              {durationOption === 'custom' && (
                <div>
                  <label className="input-label" htmlFor="manager-custom-duration">
                    Enter Duration (Years) *
                  </label>
                  <input
                    id="manager-custom-duration"
                    type="number"
                    min="1"
                    step="1"
                    required
                    className="input-field"
                    placeholder="e.g. 6, 7, 8"
                    value={customDurationInput}
                    onChange={(e) => setCustomDurationInput(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="input-label" htmlFor="manager-initial-branch">
                Initial Branch (Optional)
              </label>
              <input
                id="manager-initial-branch"
                type="text"
                className="input-field"
                placeholder="e.g. General, Computer Applications"
                value={initialBranchInput}
                onChange={(e) => setInitialBranchInput(e.target.value)}
              />
            </div>

            <div className="modal-footer" style={{ marginTop: '0.5rem' }}>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setSubModal(null)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={isLoading}>
                Create Degree
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* SUB-MODAL: EDIT DEGREE                                                */}
      {/* ===================================================================== */}
      {subModal?.type === 'EDIT_DEGREE' && (
        <Modal
          isOpen={true}
          onClose={() => setSubModal(null)}
          title={`Edit Degree: ${subModal.degree.name}`}
        >
          <form onSubmit={handleSaveEditDegree} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {operationError && (
              <Alert variant="danger" dismissible onDismiss={() => setOperationError(null)}>
                {operationError}
              </Alert>
            )}

            <div>
              <label className="input-label" htmlFor="edit-degree-name">
                Degree / Program Name *
              </label>
              <input
                id="edit-degree-name"
                type="text"
                required
                className="input-field"
                value={degreeNameInput}
                onChange={(e) => setDegreeNameInput(e.target.value)}
                autoFocus
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                Modifying the degree name automatically updates existing Student and Faculty records.
              </span>
            </div>

            <div>
              <label className="input-label">Duration *</label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                {(['1', '2', '3', '4', '5'] as const).map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setDurationOption(yr)}
                    style={{
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderRadius: '0.375rem',
                      border: durationOption === yr ? '1px solid #2563eb' : '1px solid #cbd5e1',
                      backgroundColor: durationOption === yr ? '#eff6ff' : '#ffffff',
                      color: durationOption === yr ? '#1d4ed8' : '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    {yr} {yr === '1' ? 'Year' : 'Years'}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setDurationOption('custom')}
                  style={{
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    borderRadius: '0.375rem',
                    border: durationOption === 'custom' ? '1px solid #2563eb' : '1px solid #cbd5e1',
                    backgroundColor: durationOption === 'custom' ? '#eff6ff' : '#ffffff',
                    color: durationOption === 'custom' ? '#1d4ed8' : '#334155',
                    cursor: 'pointer',
                  }}
                >
                  Custom
                </button>
              </div>

              {durationOption === 'custom' && (
                <div>
                  <label className="input-label" htmlFor="edit-custom-duration">
                    Enter Duration (Years) *
                  </label>
                  <input
                    id="edit-custom-duration"
                    type="number"
                    min="1"
                    step="1"
                    required
                    className="input-field"
                    value={customDurationInput}
                    onChange={(e) => setCustomDurationInput(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div
              style={{
                padding: '0.75rem',
                backgroundColor: '#f8fafc',
                borderRadius: '0.375rem',
                border: '1px solid #e2e8f0',
                fontSize: '0.8rem',
                color: '#475569',
              }}
            >
              All {subModal.degree.branches.length} configured branches under this degree will be preserved.
            </div>

            <div className="modal-footer" style={{ marginTop: '0.5rem' }}>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setSubModal(null)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={isLoading}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* SUB-MODAL: ADD BRANCH                                                 */}
      {/* ===================================================================== */}
      {subModal?.type === 'ADD_BRANCH' && (
        <Modal
          isOpen={true}
          onClose={() => setSubModal(null)}
          title={`Add Branch to ${subModal.degreeName}`}
        >
          <form onSubmit={handleSaveAddBranch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {operationError && (
              <Alert variant="danger" dismissible onDismiss={() => setOperationError(null)}>
                {operationError}
              </Alert>
            )}

            <div>
              <label className="input-label" htmlFor="add-branch-name-input">
                Branch Name *
              </label>
              <input
                id="add-branch-name-input"
                type="text"
                required
                className="input-field"
                placeholder="e.g. Artificial Intelligence & Machine Learning"
                value={branchNameInput}
                onChange={(e) => setBranchNameInput(e.target.value)}
                autoFocus
              />
            </div>

            <div className="modal-footer" style={{ marginTop: '0.5rem' }}>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setSubModal(null)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={isLoading}>
                Add Branch
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* SUB-MODAL: EDIT BRANCH                                                */}
      {/* ===================================================================== */}
      {subModal?.type === 'EDIT_BRANCH' && (
        <Modal
          isOpen={true}
          onClose={() => setSubModal(null)}
          title={`Edit Branch: ${subModal.branchName}`}
        >
          <form onSubmit={handleSaveEditBranch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {operationError && (
              <Alert variant="danger" dismissible onDismiss={() => setOperationError(null)}>
                {operationError}
              </Alert>
            )}

            <div>
              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                Associated Degree / Program
              </span>
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '0.375rem',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  color: '#334155',
                  marginBottom: '1rem',
                }}
              >
                {subModal.degreeName}
              </div>
            </div>

            <div>
              <label className="input-label" htmlFor="edit-branch-name-input">
                Branch Name *
              </label>
              <input
                id="edit-branch-name-input"
                type="text"
                required
                className="input-field"
                value={branchNameInput}
                onChange={(e) => setBranchNameInput(e.target.value)}
                autoFocus
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                Modifying the branch name automatically updates existing Student and Faculty records using this branch.
              </span>
            </div>

            <div className="modal-footer" style={{ marginTop: '0.5rem' }}>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setSubModal(null)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={isLoading}>
                Save Branch Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* SUB-MODAL: DEGREE DELETE — SIMPLE CONFIRMATION (0 Records)           */}
      {/* ===================================================================== */}
      {subModal?.type === 'DELETE_DEGREE_CONFIRM_SIMPLE' && (
        <Modal
          isOpen={true}
          onClose={() => setSubModal(null)}
          title={`Delete Degree: ${subModal.degree.name}?`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155' }}>
              Are you sure you want to delete the academic degree <strong>"{subModal.degree.name}"</strong>?
              No student or faculty records are currently referencing this degree.
            </p>

            <div className="modal-footer" style={{ marginTop: '0.5rem' }}>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setSubModal(null)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                type="button"
                isLoading={isLoading}
                onClick={() => handleExecuteDeleteDegree(subModal.degree, 'CONFIG_ONLY')}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* SUB-MODAL: DEGREE DELETE — THREE CHOICES (Records Exist)               */}
      {/* ===================================================================== */}
      {subModal?.type === 'DELETE_DEGREE_CHOICE' && (
        <Modal
          isOpen={true}
          onClose={() => setSubModal(null)}
          title="Delete Degree / Program"
          size="normal"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.85rem',
                backgroundColor: '#fffbeb',
                borderRadius: '0.5rem',
                border: '1px solid #fde68a',
              }}
            >
              <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#92400e' }}>
                  Related Records Detected
                </span>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#b45309' }}>
                  This degree has associated records. Please choose one of the three actions below:
                </p>
              </div>
            </div>

            {/* Degree & Related Records Summary */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                padding: '0.85rem',
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Degree:</span>
                <strong style={{ color: '#1e293b' }}>{subModal.degree.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Duration:</span>
                <strong style={{ color: '#1e293b' }}>{subModal.degree.durationYears} Years</strong>
              </div>
              <div style={{ marginTop: '0.25rem', paddingTop: '0.25rem', borderTop: '1px dashed #cbd5e1' }}>
                <span style={{ color: '#475569', fontWeight: 600 }}>Related records:</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '0.5rem' }}>
                <span style={{ color: '#64748b' }}>Students:</span>
                <strong style={{ color: '#d97706' }}>{subModal.studentsCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '0.5rem' }}>
                <span style={{ color: '#64748b' }}>Faculty:</span>
                <strong style={{ color: '#d97706' }}>{subModal.facultyCount}</strong>
              </div>
            </div>

            {/* THREE PRIMARY OPTIONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Option 2: Delete Only This Degree/Program */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleExecuteDeleteDegree(subModal.degree, 'CONFIG_ONLY')}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    handleExecuteDeleteDegree(subModal.degree, 'CONFIG_ONLY');
                  }
                }}
                style={{
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '0.5rem',
                  padding: '0.9rem',
                  cursor: 'pointer',
                  backgroundColor: '#ffffff',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2563eb')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#cbd5e1')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b' }}>
                    Delete Only This Degree/Program
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '1rem',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                    }}
                  >
                    Keep Records
                  </span>
                </div>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
                  Delete only the selected Degree/Program configuration. Do <strong>NOT</strong> delete Student or Faculty records. Existing records remain safely preserved.
                </p>
              </div>

              {/* Option 3: Delete This Degree + All Related Student & Faculty Records */}
              <div
                role="button"
                tabIndex={0}
                onClick={() =>
                  setSubModal({
                    type: 'DELETE_DEGREE_CONFIRM_CASCADE',
                    degree: subModal.degree,
                    studentsCount: subModal.studentsCount,
                    facultyCount: subModal.facultyCount,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    setSubModal({
                      type: 'DELETE_DEGREE_CONFIRM_CASCADE',
                      degree: subModal.degree,
                      studentsCount: subModal.studentsCount,
                      facultyCount: subModal.facultyCount,
                    });
                  }
                }}
                style={{
                  border: '1.5px solid #fca5a5',
                  borderRadius: '0.5rem',
                  padding: '0.9rem',
                  cursor: 'pointer',
                  backgroundColor: '#fff5f5',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#dc2626')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#fca5a5')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#b91c1c' }}>
                    Delete This Degree + All Related Student & Faculty Records
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '1rem',
                      backgroundColor: '#fee2e2',
                      color: '#b91c1c',
                    }}
                  >
                    Destructive
                  </span>
                </div>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#7f1d1d', lineHeight: 1.4 }}>
                  Permanently delete this Degree/Program configuration <strong>AND permanently delete all {subModal.studentsCount} Student and {subModal.facultyCount} Faculty records</strong> associated with it. Requires secondary confirmation.
                </p>
              </div>
            </div>

            {/* Option 1: Cancel Button */}
            <div className="modal-footer" style={{ marginTop: '0.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="ghost" type="button" onClick={() => setSubModal(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* SUB-MODAL: DEGREE DELETE — FINAL CONFIRMATION (Option 3 Destructive)   */}
      {/* ===================================================================== */}
      {subModal?.type === 'DELETE_DEGREE_CONFIRM_CASCADE' && (
        <Modal
          isOpen={true}
          onClose={() => setSubModal(null)}
          title="Final Confirmation"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1.5px solid #fecaca',
                borderRadius: '0.5rem',
                padding: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b91c1c', fontWeight: 700 }}>
                <AlertTriangle size={18} />
                <span>Permanent Deletion Warning</span>
              </div>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.84rem', color: '#991b1b', lineHeight: 1.45 }}>
                You are about to permanently delete:
              </p>
              <ul style={{ margin: '0.4rem 0 0 1.25rem', padding: 0, fontSize: '0.84rem', color: '#991b1b', lineHeight: 1.5 }}>
                <li><strong>{subModal.degree.name}</strong> Degree configuration</li>
                <li><strong>{subModal.studentsCount}</strong> Student records</li>
                <li><strong>{subModal.facultyCount}</strong> Faculty records</li>
              </ul>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', fontWeight: 600, color: '#7f1d1d' }}>
                This action cannot be undone.
              </p>
            </div>

            {operationError && (
              <Alert variant="danger" dismissible onDismiss={() => setOperationError(null)}>
                {operationError}
              </Alert>
            )}

            <div className="modal-footer" style={{ marginTop: '0.5rem' }}>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setSubModal(null)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                type="button"
                isLoading={isLoading}
                onClick={() => handleExecuteDeleteDegree(subModal.degree, 'CASCADE')}
              >
                Confirm Permanent Deletion
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* SUB-MODAL: BRANCH DELETE — SIMPLE CONFIRMATION (0 Records)            */}
      {/* ===================================================================== */}
      {subModal?.type === 'DELETE_BRANCH_CONFIRM_SIMPLE' && (
        <Modal
          isOpen={true}
          onClose={() => setSubModal(null)}
          title={`Delete Branch: ${subModal.branchName}?`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155' }}>
              Are you sure you want to remove the branch <strong>"{subModal.branchName}"</strong> from <strong>{subModal.degreeName}</strong>? No student or faculty records are currently referencing this branch.
            </p>

            <div className="modal-footer" style={{ marginTop: '0.5rem' }}>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setSubModal(null)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                type="button"
                isLoading={isLoading}
                onClick={() => handleExecuteDeleteBranch(subModal.degreeName, subModal.branchName, 'CONFIG_ONLY')}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* SUB-MODAL: BRANCH DELETE — THREE CHOICES (Records Exist)               */}
      {/* ===================================================================== */}
      {subModal?.type === 'DELETE_BRANCH_CHOICE' && (
        <Modal
          isOpen={true}
          onClose={() => setSubModal(null)}
          title="Delete Branch"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.85rem',
                backgroundColor: '#fffbeb',
                borderRadius: '0.5rem',
                border: '1px solid #fde68a',
              }}
            >
              <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#92400e' }}>
                  Related Records Detected
                </span>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#b45309' }}>
                  This branch has associated records. Please choose one of the three actions below:
                </p>
              </div>
            </div>

            {/* Branch Summary */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                padding: '0.85rem',
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Degree:</span>
                <strong style={{ color: '#1e293b' }}>{subModal.degreeName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Branch:</span>
                <strong style={{ color: '#1e293b' }}>{subModal.branchName}</strong>
              </div>
              <div style={{ marginTop: '0.25rem', paddingTop: '0.25rem', borderTop: '1px dashed #cbd5e1' }}>
                <span style={{ color: '#475569', fontWeight: 600 }}>Related records:</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '0.5rem' }}>
                <span style={{ color: '#64748b' }}>Students:</span>
                <strong style={{ color: '#d97706' }}>{subModal.studentsCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '0.5rem' }}>
                <span style={{ color: '#64748b' }}>Faculty:</span>
                <strong style={{ color: '#d97706' }}>{subModal.facultyCount}</strong>
              </div>
            </div>

            {/* THREE PRIMARY OPTIONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Option 2: Delete Only This Branch */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleExecuteDeleteBranch(subModal.degreeName, subModal.branchName, 'CONFIG_ONLY')}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    handleExecuteDeleteBranch(subModal.degreeName, subModal.branchName, 'CONFIG_ONLY');
                  }
                }}
                style={{
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '0.5rem',
                  padding: '0.9rem',
                  cursor: 'pointer',
                  backgroundColor: '#ffffff',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2563eb')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#cbd5e1')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b' }}>
                    Delete Only This Branch
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '1rem',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                    }}
                  >
                    Keep Records
                  </span>
                </div>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
                  Delete only the Branch configuration from {subModal.degreeName}. Do <strong>NOT</strong> delete Student or Faculty records. Existing records remain safely preserved.
                </p>
              </div>

              {/* Option 3: Delete This Branch + All Related Student & Faculty Records */}
              <div
                role="button"
                tabIndex={0}
                onClick={() =>
                  setSubModal({
                    type: 'DELETE_BRANCH_CONFIRM_CASCADE',
                    degreeName: subModal.degreeName,
                    branchName: subModal.branchName,
                    studentsCount: subModal.studentsCount,
                    facultyCount: subModal.facultyCount,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    setSubModal({
                      type: 'DELETE_BRANCH_CONFIRM_CASCADE',
                      degreeName: subModal.degreeName,
                      branchName: subModal.branchName,
                      studentsCount: subModal.studentsCount,
                      facultyCount: subModal.facultyCount,
                    });
                  }
                }}
                style={{
                  border: '1.5px solid #fca5a5',
                  borderRadius: '0.5rem',
                  padding: '0.9rem',
                  cursor: 'pointer',
                  backgroundColor: '#fff5f5',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#dc2626')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#fca5a5')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#b91c1c' }}>
                    Delete This Branch + All Related Student & Faculty Records
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '1rem',
                      backgroundColor: '#fee2e2',
                      color: '#b91c1c',
                    }}
                  >
                    Destructive
                  </span>
                </div>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#7f1d1d', lineHeight: 1.4 }}>
                  Permanently delete this branch configuration <strong>AND permanently delete all {subModal.studentsCount} Student and {subModal.facultyCount} Faculty records</strong> associated with this branch. Records from other branches will NOT be affected. Requires secondary confirmation.
                </p>
              </div>
            </div>

            {/* Option 1: Cancel Button */}
            <div className="modal-footer" style={{ marginTop: '0.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="ghost" type="button" onClick={() => setSubModal(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* SUB-MODAL: BRANCH DELETE — FINAL CONFIRMATION (Option 3 Destructive)   */}
      {/* ===================================================================== */}
      {subModal?.type === 'DELETE_BRANCH_CONFIRM_CASCADE' && (
        <Modal
          isOpen={true}
          onClose={() => setSubModal(null)}
          title="Final Confirmation"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1.5px solid #fecaca',
                borderRadius: '0.5rem',
                padding: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b91c1c', fontWeight: 700 }}>
                <AlertTriangle size={18} />
                <span>Permanent Deletion Warning</span>
              </div>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.84rem', color: '#991b1b', lineHeight: 1.45 }}>
                You are about to permanently delete:
              </p>
              <ul style={{ margin: '0.4rem 0 0 1.25rem', padding: 0, fontSize: '0.84rem', color: '#991b1b', lineHeight: 1.5 }}>
                <li><strong>{subModal.branchName}</strong> Branch configuration (Degree: {subModal.degreeName})</li>
                <li><strong>{subModal.studentsCount}</strong> Student records</li>
                <li><strong>{subModal.facultyCount}</strong> Faculty records</li>
              </ul>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', fontWeight: 600, color: '#7f1d1d' }}>
                This action cannot be undone.
              </p>
            </div>

            {operationError && (
              <Alert variant="danger" dismissible onDismiss={() => setOperationError(null)}>
                {operationError}
              </Alert>
            )}

            <div className="modal-footer" style={{ marginTop: '0.5rem' }}>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setSubModal(null)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                type="button"
                isLoading={isLoading}
                onClick={() => handleExecuteDeleteBranch(subModal.degreeName, subModal.branchName, 'CASCADE')}
              >
                Confirm Permanent Deletion
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
