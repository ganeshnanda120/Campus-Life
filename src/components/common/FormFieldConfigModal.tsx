import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Plus, Trash2, Lock, ShieldCheck, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import type {
  FormConfigType,
  FormFieldDefinition,
  FormConfiguration,
  UserRole,
} from '../../types';
import { formConfigService } from '../../services/formConfigService';

export interface FormFieldConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  formType: FormConfigType;
  config: FormConfiguration;
  onConfigUpdated: (newConfig: FormConfiguration) => void;
  onOpenAddCustomField: () => void;
  actor?: { uid: string; name: string; role: UserRole };
}

export const FormFieldConfigModal: React.FC<FormFieldConfigModalProps> = ({
  isOpen,
  onClose,
  formType,
  config,
  onConfigUpdated,
  onOpenAddCustomField,
  actor,
}) => {
  const [fieldToDelete, setFieldToDelete] = useState<FormFieldDefinition | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formTypeLabel =
    formType === 'STUDENT' ? 'Student' : formType === 'FACULTY' ? 'Faculty' : 'Sub-Admin';

  const handleToggleRequirement = async (field: FormFieldDefinition) => {
    if (field.isProtected) return;
    setError(null);
    try {
      const newRequired = !field.required;
      const res = await formConfigService.updateField(
        formType,
        field.id,
        { required: newRequired },
        actor
      );
      if (res.success && res.config) {
        onConfigUpdated(res.config);
      } else {
        setError(res.error || 'Failed to update field requirement.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error updating field requirement.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!fieldToDelete) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await formConfigService.removeField(formType, fieldToDelete.id, actor);
      if (res.success && res.config) {
        onConfigUpdated(res.config);
        setFieldToDelete(null);
      } else {
        setError(res.error || 'Failed to remove field.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error removing field.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreDefaults = async () => {
    if (!window.confirm('Restore all default form fields to standard settings? Custom fields will be preserved.')) {
      return;
    }
    setIsRestoring(true);
    setError(null);
    try {
      const res = await formConfigService.restoreDefaults(formType, actor);
      if (res.success && res.config) {
        onConfigUpdated(res.config);
      }
    } catch (err: any) {
      setError(err?.message || 'Error restoring default fields.');
    } finally {
      setIsRestoring(false);
    }
  };

  const activeFields = config.fields.filter((f) => f.enabled);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Form Field Configuration — ${formTypeLabel} Registration`}
        size="large"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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

          {/* Subtitle description */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted, #64748b)' }}>
              Configure existing standard fields and manage custom fields. Security-critical identity and authentication fields are strictly protected.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw size={14} />}
                onClick={handleRestoreDefaults}
                isLoading={isRestoring}
              >
                Restore Defaults
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => {
                  onClose();
                  onOpenAddCustomField();
                }}
              >
                + Add Custom Field
              </Button>
            </div>
          </div>

          {/* Fields list */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
              maxHeight: '60vh',
              overflowY: 'auto',
              paddingRight: '0.25rem',
            }}
          >
            {activeFields.map((field) => {
              return (
                <div
                  key={field.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: '0.5rem',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  {/* Left: Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '200px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-main, #0f172a)' }}>
                        {field.label}
                      </span>
                      {field.required && (
                        <span style={{ color: '#dc2626', fontWeight: 700 }}>*</span>
                      )}
                      {field.isCustom ? (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.45rem',
                            backgroundColor: '#e0e7ff',
                            color: '#4338ca',
                            borderRadius: '9999px',
                            fontWeight: 600,
                          }}
                        >
                          Custom Field
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.45rem',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            borderRadius: '9999px',
                            fontWeight: 500,
                          }}
                        >
                          Standard Field
                        </span>
                      )}

                      {field.isProtected && (
                        <span
                          title={field.protectedReason}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.45rem',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            borderRadius: '9999px',
                            fontWeight: 600,
                          }}
                        >
                          <Lock size={10} />
                          Protected
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)' }}>
                      <span>Type: <strong style={{ textTransform: 'capitalize' }}>{field.type}</strong></span>
                      <span>•</span>
                      <span>
                        Scope:{' '}
                        <strong>
                          {field.scope === 'ALL'
                            ? `All ${formTypeLabel}s`
                            : `${field.selectedUserIds?.length || 0} Selected Users`}
                        </strong>
                      </span>
                      {field.type === 'dropdown' && field.options && (
                        <>
                          <span>•</span>
                          <span>Options: <strong>{field.options.join(', ')}</strong></span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {/* Required / Optional Toggle Button */}
                    {field.isProtected ? (
                      <span
                        title={field.protectedReason}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.375rem',
                          backgroundColor: '#f1f5f9',
                          color: '#64748b',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'not-allowed',
                          border: '1px solid #cbd5e1',
                        }}
                      >
                        <ShieldCheck size={14} color="#059669" />
                        <span>Always Required</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleRequirement(field)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.375rem',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          border: field.required ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                          backgroundColor: field.required ? '#eff6ff' : '#ffffff',
                          color: field.required ? '#1d4ed8' : '#64748b',
                        }}
                      >
                        {field.required ? (
                          <>
                            <Check size={14} color="#2563eb" />
                            <span>Required</span>
                          </>
                        ) : (
                          <span>Optional</span>
                        )}
                      </button>
                    )}

                    {/* Remove Button */}
                    {field.isProtected ? (
                      <button
                        type="button"
                        disabled
                        title={field.protectedReason}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '0.375rem',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#f8fafc',
                          color: '#cbd5e1',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'not-allowed',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setFieldToDelete(field)}
                        aria-label={`Remove field ${field.label}`}
                        title="Remove field from form"
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '0.375rem',
                          border: '1px solid #fee2e2',
                          backgroundColor: '#fef2f2',
                          color: '#dc2626',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#fee2e2';
                          e.currentTarget.style.borderColor = '#fca5a5';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#fef2f2';
                          e.currentTarget.style.borderColor = '#fee2e2';
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border, #e2e8f0)' }}>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Dialog for Field Removal */}
      {fieldToDelete && (
        <Modal
          isOpen={true}
          onClose={() => setFieldToDelete(null)}
          title="Remove Form Field"
          size="normal"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: 'var(--color-text-main)' }}>
                  Remove "{fieldToDelete.label}"?
                </h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  This field will no longer appear in the {formTypeLabel} registration and editing forms.
                  Any values stored in existing student/user records will be preserved safely.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Button variant="ghost" onClick={() => setFieldToDelete(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDelete}
                isLoading={isDeleting}
              >
                Remove Field
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
