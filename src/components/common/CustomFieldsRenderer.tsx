import React from 'react';
import { Plus, Settings2 } from 'lucide-react';
import type { FormFieldDefinition, UserRecord } from '../../types';
import { formConfigService } from '../../services/formConfigService';

export interface CustomFieldsRendererProps {
  fields: FormFieldDefinition[];
  values: Record<string, any>;
  onChange: (fieldIdOrKey: string, value: any) => void;
  errors?: Record<string, string>;
  targetUser?: UserRecord | null;
  onOpenAddField: () => void;
  onOpenConfigureFields?: () => void;
  canManage?: boolean;
}

export const CustomFieldsRenderer: React.FC<CustomFieldsRendererProps> = ({
  fields,
  values,
  onChange,
  errors = {},
  targetUser,
  onOpenAddField,
  onOpenConfigureFields,
  canManage = true,
}) => {
  // Only render custom fields that are enabled and applicable to the user
  const applicableCustomFields = fields.filter(
    (f) => f.isCustom && f.enabled && formConfigService.isFieldApplicable(f, targetUser)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--color-border, #e2e8f0)',
          paddingBottom: '0.4rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-primary, #2563eb)' }}>
          Custom Details
        </h4>

        {canManage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onOpenAddField}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.25rem 0.6rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: '0.375rem',
                color: '#2563eb',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#dbeafe';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#eff6ff';
              }}
            >
              <Plus size={13} />
              <span>Add Custom Field</span>
            </button>

            {onOpenConfigureFields && (
              <button
                type="button"
                onClick={onOpenConfigureFields}
                title="Configure form fields"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  borderRadius: '0.375rem',
                  color: '#64748b',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
              >
                <Settings2 size={13} />
                <span>Configure</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Fields Grid */}
      {applicableCustomFields.length === 0 ? (
        <div
          style={{
            padding: '1rem',
            textAlign: 'center',
            backgroundColor: 'var(--color-bg-secondary, #f8fafc)',
            borderRadius: '0.375rem',
            border: '1px dashed var(--color-border, #cbd5e1)',
            color: 'var(--color-text-muted, #64748b)',
            fontSize: '0.82rem',
          }}
        >
          <span>No custom fields configured for this form yet.</span>
          {canManage && (
            <div style={{ marginTop: '0.4rem' }}>
              <button
                type="button"
                onClick={onOpenAddField}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                + Add your first custom field
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {applicableCustomFields.map((field) => {
            const val = values[field.id] ?? values[field.key] ?? '';
            const fieldError = errors[field.id] || errors[field.key];

            return (
              <div
                key={field.id}
                style={{
                  gridColumn: field.type === 'textarea' ? '1 / -1' : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <label
                  className="input-label"
                  htmlFor={`custom-${field.id}`}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>
                    {field.label} {field.required && <span style={{ color: '#dc2626' }}>*</span>}
                  </span>
                  {!field.required && (
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 400 }}>
                      Optional
                    </span>
                  )}
                </label>

                {field.type === 'textarea' ? (
                  <textarea
                    id={`custom-${field.id}`}
                    rows={3}
                    className="input-field"
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                    value={val}
                    onChange={(e) => onChange(field.id, e.target.value)}
                    style={{
                      borderColor: fieldError ? '#dc2626' : undefined,
                      resize: 'vertical',
                    }}
                  />
                ) : field.type === 'dropdown' ? (
                  <select
                    id={`custom-${field.id}`}
                    className="input-field"
                    value={val}
                    onChange={(e) => onChange(field.id, e.target.value)}
                    style={{ borderColor: fieldError ? '#dc2626' : undefined }}
                  >
                    <option value="">Select {field.label}...</option>
                    {(field.options || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`custom-${field.id}`}
                    type={field.type}
                    className="input-field"
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                    value={val}
                    onChange={(e) => onChange(field.id, e.target.value)}
                    style={{ borderColor: fieldError ? '#dc2626' : undefined }}
                  />
                )}

                {fieldError && (
                  <span style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '0.2rem' }}>
                    {fieldError}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
