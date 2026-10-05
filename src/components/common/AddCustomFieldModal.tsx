import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Plus, X, Search, Check } from 'lucide-react';
import type {
  CustomFieldType,
  CustomFieldScopeType,
  FormFieldDefinition,
  FormConfigType,
  UserRecord,
} from '../../types';

export interface AddCustomFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  formType: FormConfigType;
  availableUsers: UserRecord[];
  onSave: (fieldDef: Omit<FormFieldDefinition, 'id' | 'order' | 'isCustom' | 'isProtected'>) => Promise<boolean>;
}

export const AddCustomFieldModal: React.FC<AddCustomFieldModalProps> = ({
  isOpen,
  onClose,
  formType,
  availableUsers,
  onSave,
}) => {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [required, setRequired] = useState(false);
  const [scope, setScope] = useState<CustomFieldScopeType>('ALL');
  const [options, setOptions] = useState<string[]>(['Option 1', 'Option 2']);
  const [newOption, setNewOption] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formTypeLabel =
    formType === 'STUDENT' ? 'Student' : formType === 'FACULTY' ? 'Faculty' : 'Sub-Admin';

  const resetForm = () => {
    setLabel('');
    setType('text');
    setRequired(false);
    setScope('ALL');
    setOptions(['Option 1', 'Option 2']);
    setNewOption('');
    setSelectedUserIds([]);
    setUserSearchQuery('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAddOption = () => {
    const trimmed = newOption.trim();
    if (!trimmed) return;
    if (options.some((o) => o.toLowerCase() === trimmed.toLowerCase())) {
      setError(`Option "${trimmed}" already exists.`);
      return;
    }
    setOptions([...options, trimmed]);
    setNewOption('');
    setError(null);
  };

  const handleRemoveOption = (indexToRemove: number) => {
    if (options.length <= 1) {
      setError('Dropdown must have at least one choice.');
      return;
    }
    setOptions(options.filter((_, idx) => idx !== indexToRemove));
    setError(null);
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAllFiltered = (filteredIds: string[]) => {
    setSelectedUserIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const handleDeselectAll = () => {
    setSelectedUserIds([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanLabel = label.trim();
    if (!cleanLabel) {
      setError('Field Label / Name is required.');
      return;
    }

    if (type === 'dropdown' && options.length === 0) {
      setError('Please add at least one option for the dropdown field.');
      return;
    }

    if (scope === 'SELECTED' && selectedUserIds.length === 0) {
      setError(`Please select at least one ${formTypeLabel.toLowerCase()} when scope is set to "Selected Users".`);
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onSave({
        key: cleanLabel.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        label: cleanLabel,
        type,
        required,
        enabled: true,
        scope,
        options: type === 'dropdown' ? options : undefined,
        selectedUserIds: scope === 'SELECTED' ? selectedUserIds : undefined,
        section: 'Custom Details',
      });

      if (success) {
        handleClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create custom field.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = availableUsers.filter((u) => {
    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.trim().toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.studentId && u.studentId.toLowerCase().includes(q)) ||
      (u.employeeId && u.employeeId.toLowerCase().includes(q))
    );
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Add Custom Field — ${formTypeLabel} Form`}
      size="normal"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.375rem',
              color: '#dc2626',
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Field Name */}
        <div>
          <label className="input-label" htmlFor="custom-field-name">
            Field Name / Label *
          </label>
          <input
            id="custom-field-name"
            type="text"
            required
            className="input-field"
            placeholder="e.g. Blood Group, Emergency Contact, Guardian PAN"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        {/* Field Type */}
        <div>
          <label className="input-label" htmlFor="custom-field-type">
            Field Type *
          </label>
          <select
            id="custom-field-type"
            className="input-field"
            value={type}
            onChange={(e) => setType(e.target.value as CustomFieldType)}
          >
            <option value="text">Text (Single-line)</option>
            <option value="number">Number (Numeric values)</option>
            <option value="email">Email Address</option>
            <option value="phone">Phone / Mobile Number</option>
            <option value="date">Date (Calendar picker)</option>
            <option value="textarea">Textarea (Multi-line notes/address)</option>
            <option value="dropdown">Dropdown (Select from custom choices)</option>
          </select>
        </div>

        {/* Dropdown Options Builder */}
        {type === 'dropdown' && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-border, #e2e8f0)',
            }}
          >
            <label className="input-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
              Dropdown Options *
            </label>

            {/* Add Choice Row */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <input
                type="text"
                className="input-field"
                placeholder="Enter choice name (e.g. A+, B+, Day Scholar)"
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddOption();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddOption}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '0.375rem',
                  color: '#2563eb',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#dbeafe';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#eff6ff';
                }}
              >
                <Plus size={14} />
                <span>Add Choice</span>
              </button>
            </div>

            {/* Choices list */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {options.map((opt, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.25rem 0.6rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--color-border, #cbd5e1)',
                    borderRadius: '9999px',
                    fontSize: '0.82rem',
                    color: 'var(--color-text-main, #0f172a)',
                  }}
                >
                  <span>{opt}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    aria-label={`Remove option ${opt}`}
                    title="Remove choice"
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '9999px',
                      border: 'none',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Required / Optional Setting */}
        <div>
          <label className="input-label" style={{ marginBottom: '0.4rem', display: 'block' }}>
            Field Requirement *
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setRequired(true)}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '0.375rem',
                border: required ? '2px solid #2563eb' : '1px solid var(--color-border, #cbd5e1)',
                backgroundColor: required ? '#eff6ff' : 'var(--color-bg-surface, #ffffff)',
                color: required ? '#1e40af' : 'var(--color-text-main, #0f172a)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              {required && <Check size={16} />}
              <span>Required *</span>
            </button>

            <button
              type="button"
              onClick={() => setRequired(false)}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '0.375rem',
                border: !required ? '2px solid #2563eb' : '1px solid var(--color-border, #cbd5e1)',
                backgroundColor: !required ? '#eff6ff' : 'var(--color-bg-surface, #ffffff)',
                color: !required ? '#1e40af' : 'var(--color-text-main, #0f172a)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              {!required && <Check size={16} />}
              <span>Optional</span>
            </button>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)', marginTop: '0.25rem', display: 'block' }}>
            {required
              ? 'Users must fill this field before submitting the form.'
              : 'Users may leave this field blank without blocking form submission.'}
          </span>
        </div>

        {/* Scope Setting */}
        <div>
          <label className="input-label" style={{ marginBottom: '0.4rem', display: 'block' }}>
            Field Scope / Visibility *
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setScope('ALL')}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '0.375rem',
                border: scope === 'ALL' ? '2px solid #2563eb' : '1px solid var(--color-border, #cbd5e1)',
                backgroundColor: scope === 'ALL' ? '#eff6ff' : 'var(--color-bg-surface, #ffffff)',
                color: scope === 'ALL' ? '#1e40af' : 'var(--color-text-main, #0f172a)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              {scope === 'ALL' && <Check size={16} />}
              <span>For All {formTypeLabel}s</span>
            </button>

            <button
              type="button"
              onClick={() => setScope('SELECTED')}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '0.375rem',
                border: scope === 'SELECTED' ? '2px solid #2563eb' : '1px solid var(--color-border, #cbd5e1)',
                backgroundColor: scope === 'SELECTED' ? '#eff6ff' : 'var(--color-bg-surface, #ffffff)',
                color: scope === 'SELECTED' ? '#1e40af' : 'var(--color-text-main, #0f172a)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              {scope === 'SELECTED' && <Check size={16} />}
              <span>For Selected Users</span>
            </button>
          </div>
        </div>

        {/* User Multi-Select Picker (When Scope = SELECTED) */}
        {scope === 'SELECTED' && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-border, #e2e8f0)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label className="input-label" style={{ margin: 0 }}>
                Select {formTypeLabel}s ({selectedUserIds.length} selected)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleSelectAllFiltered(filteredUsers.map((u) => u.uid))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Select All
                </button>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                }}
              />
              <input
                type="text"
                className="input-field"
                placeholder={`Search ${formTypeLabel.toLowerCase()} by name, email, or ID...`}
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
              />
            </div>

            {/* Scrollable list */}
            <div
              style={{
                maxHeight: '180px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                paddingRight: '0.25rem',
              }}
            >
              {filteredUsers.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No {formTypeLabel.toLowerCase()}s match your search query.
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isChecked = selectedUserIds.includes(u.uid);
                  return (
                    <label
                      key={u.uid}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: '0.4rem 0.6rem',
                        backgroundColor: isChecked ? '#eff6ff' : '#ffffff',
                        border: isChecked ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleUser(u.uid)}
                        style={{ cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-main, #0f172a)' }}>
                          {u.name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.email} {u.studentId ? `• ID: ${u.studentId}` : u.employeeId ? `• ID: ${u.employeeId}` : ''}
                        </span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <Button variant="ghost" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting}>
            Create Custom Field
          </Button>
        </div>
      </form>
    </Modal>
  );
};
