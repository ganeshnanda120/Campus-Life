import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { safeStorage } from '../firebase/authService';
import { auditService } from './auditService';
import type {
  FormConfigType,
  FormFieldDefinition,
  FormConfiguration,
  UserRole,
} from '../types';

const FORM_CONFIG_STORAGE_PREFIX = 'campus_life_form_config_';

export const DEFAULT_STUDENT_FIELDS: FormFieldDefinition[] = [
  {
    id: 'field_stu_name',
    key: 'name',
    label: 'Full Name',
    type: 'text',
    required: true,
    enabled: true,
    isCustom: false,
    isProtected: true,
    protectedReason: 'Essential for student identity records and official transcripts',
    scope: 'ALL',
    section: 'Basic Information',
    placeholder: 'e.g. Rahul Sharma',
    order: 1,
  },
  {
    id: 'field_stu_email',
    key: 'email',
    label: 'Email Address',
    type: 'email',
    required: true,
    enabled: true,
    isCustom: false,
    isProtected: true,
    protectedReason: 'Primary credential for Firebase Authentication and student portal access',
    scope: 'ALL',
    section: 'Basic Information',
    placeholder: 'rahul.s@example.com',
    order: 2,
  },
  {
    id: 'field_stu_student_id',
    key: 'studentId',
    label: 'Student ID',
    type: 'text',
    required: true,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    section: 'Basic Information',
    placeholder: 'e.g. STU2026042',
    order: 3,
  },
  {
    id: 'field_stu_roll_number',
    key: 'rollNumber',
    label: 'Roll Number',
    type: 'text',
    required: true,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    section: 'Basic Information',
    placeholder: 'e.g. 2301337042',
    order: 4,
  },
  {
    id: 'field_stu_phone',
    key: 'phone',
    label: 'Phone Number',
    type: 'phone',
    required: false,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    section: 'Basic Information',
    placeholder: '+91 98765 43210',
    order: 5,
  },
  {
    id: 'field_stu_gender',
    key: 'gender',
    label: 'Gender',
    type: 'dropdown',
    options: ['Male', 'Female', 'Other'],
    required: false,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    section: 'Basic Information',
    order: 6,
  },
  {
    id: 'field_stu_degree',
    key: 'degree',
    label: 'Degree / Program',
    type: 'dropdown',
    required: true,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    section: 'Academic Program',
    order: 7,
  },
  {
    id: 'field_stu_branch',
    key: 'branch',
    label: 'Branch',
    type: 'dropdown',
    required: true,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    section: 'Academic Program',
    order: 8,
  },
  {
    id: 'field_stu_year',
    key: 'year',
    label: 'Year',
    type: 'dropdown',
    required: true,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    section: 'Academic Program',
    order: 9,
  },
  {
    id: 'field_stu_semester',
    key: 'semester',
    label: 'Semester',
    type: 'dropdown',
    required: true,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    section: 'Academic Program',
    order: 10,
  },
  {
    id: 'field_stu_category',
    key: 'studentCategory',
    label: 'Student Category',
    type: 'dropdown',
    options: ['HOSTELER', 'DAY_SCHOLAR'],
    required: true,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    section: 'Category & Residence',
    order: 11,
  },
  {
    id: 'field_stu_hostel_name',
    key: 'hostelName',
    label: 'Hostel Name',
    type: 'text',
    required: false,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    section: 'Category & Residence',
    placeholder: 'e.g. BPUT Central Hostel',
    order: 12,
  },
  {
    id: 'field_stu_hostel_block',
    key: 'hostelBlock',
    label: 'Block',
    type: 'text',
    required: false,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    section: 'Category & Residence',
    placeholder: 'e.g. Block A',
    order: 13,
  },
  {
    id: 'field_stu_room_number',
    key: 'roomNumber',
    label: 'Room Number',
    type: 'text',
    required: false,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    section: 'Category & Residence',
    placeholder: 'e.g. 204',
    order: 14,
  },
  {
    id: 'field_stu_guardian_name',
    key: 'guardianName',
    label: 'Guardian Name',
    type: 'text',
    required: false,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    section: 'Guardian & Contact Info',
    placeholder: 'Guardian / Parent Name',
    order: 15,
  },
  {
    id: 'field_stu_guardian_phone',
    key: 'guardianPhone',
    label: 'Guardian Contact Phone',
    type: 'phone',
    required: false,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    section: 'Guardian & Contact Info',
    placeholder: '+91 98765 00000',
    order: 16,
  },
  {
    id: 'field_stu_address',
    key: 'address',
    label: 'Permanent Address',
    type: 'textarea',
    required: false,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    section: 'Guardian & Contact Info',
    placeholder: 'Permanent residential address',
    order: 17,
  },
];

export const DEFAULT_FACULTY_FIELDS: FormFieldDefinition[] = [
  {
    id: 'field_fac_name',
    key: 'name',
    label: 'Full Name',
    type: 'text',
    required: true,
    enabled: true,
    isCustom: false,
    isProtected: true,
    protectedReason: 'Essential for faculty registry, lecture assignments, and profile records',
    scope: 'ALL',
    placeholder: 'e.g. Dr. Ramesh Kumar',
    order: 1,
  },
  {
    id: 'field_fac_email',
    key: 'email',
    label: 'Email Address',
    type: 'email',
    required: true,
    enabled: true,
    isCustom: false,
    isProtected: true,
    protectedReason: 'Primary credential for faculty portal authentication and institutional mail',
    scope: 'ALL',
    placeholder: 'ramesh.k@example.com',
    order: 2,
  },
  {
    id: 'field_fac_employee_id',
    key: 'employeeId',
    label: 'Employee ID',
    type: 'text',
    required: true,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    placeholder: 'e.g. FAC2026019',
    order: 3,
  },
  {
    id: 'field_fac_degree',
    key: 'degree',
    label: 'Degree / Program',
    type: 'dropdown',
    required: true,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    order: 4,
  },
  {
    id: 'field_fac_branch',
    key: 'branch',
    label: 'Branch / Specialization',
    type: 'dropdown',
    required: false,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    placeholder: 'e.g. Computer Science & Engineering',
    order: 5,
  },
  {
    id: 'field_fac_designation',
    key: 'designation',
    label: 'Designation',
    type: 'text',
    required: true,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    placeholder: 'e.g. Associate Professor',
    order: 6,
  },
  {
    id: 'field_fac_office_location',
    key: 'officeLocation',
    label: 'Cabin / Office Location',
    type: 'text',
    required: false,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    placeholder: 'e.g. Room 302, Academic Block 2',
    order: 7,
  },
  {
    id: 'field_fac_phone',
    key: 'phone',
    label: 'Contact Phone Number',
    type: 'phone',
    required: false,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    placeholder: '+91 98765 12345',
    order: 8,
  },
];

export const DEFAULT_SUB_ADMIN_FIELDS: FormFieldDefinition[] = [
  {
    id: 'field_adm_name',
    key: 'name',
    label: 'Full Name',
    type: 'text',
    required: true,
    enabled: true,
    isCustom: false,
    isProtected: true,
    protectedReason: 'Essential for administrator attribution, audit trails, and security logs',
    scope: 'ALL',
    placeholder: 'e.g. Priya Sharma',
    order: 1,
  },
  {
    id: 'field_adm_email',
    key: 'email',
    label: 'Email Address',
    type: 'email',
    required: true,
    enabled: true,
    isCustom: false,
    isProtected: true,
    protectedReason: 'Primary credential for administrative access and security verification',
    scope: 'ALL',
    placeholder: 'priya.admin@example.com',
    order: 2,
  },
  {
    id: 'field_adm_employee_id',
    key: 'employeeId',
    label: 'Employee / Staff ID',
    type: 'text',
    required: false,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    placeholder: 'e.g. ADM2026005',
    order: 3,
  },
  {
    id: 'field_adm_department',
    key: 'department',
    label: 'Department / Unit',
    type: 'text',
    required: true,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    placeholder: 'e.g. Academic Affairs / Hostel Administration',
    order: 4,
  },
  {
    id: 'field_adm_designation',
    key: 'designation',
    label: 'Designation / Title',
    type: 'text',
    required: true,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    placeholder: 'e.g. Assistant Registrar',
    order: 5,
  },
  {
    id: 'field_adm_phone',
    key: 'phone',
    label: 'Contact Phone Number',
    type: 'phone',
    required: false,
    enabled: true,
    isCustom: false,
    isProtected: false,
    scope: 'ALL',
    placeholder: '+91 98765 00000',
    order: 6,
  },
];

function getDefaultsForType(formType: FormConfigType): FormFieldDefinition[] {
  switch (formType) {
    case 'STUDENT':
      return DEFAULT_STUDENT_FIELDS;
    case 'FACULTY':
      return DEFAULT_FACULTY_FIELDS;
    case 'SUB_ADMIN':
      return DEFAULT_SUB_ADMIN_FIELDS;
  }
}

function getLocalConfig(formType: FormConfigType): FormConfiguration {
  const key = `${FORM_CONFIG_STORAGE_PREFIX}${formType.toLowerCase()}`;
  try {
    const raw = safeStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as FormConfiguration;
      if (parsed && Array.isArray(parsed.fields)) {
        // Merge with defaults to ensure protected fields exist
        const defaults = getDefaultsForType(formType);
        let mergedFields: FormFieldDefinition[] = [...parsed.fields];
        if (formType === 'FACULTY') {
          mergedFields = mergedFields.filter((f) => f.key !== 'department' && f.id !== 'field_fac_department');
        }

        // Ensure all default fields are in the list
        for (const def of defaults) {
          const idx = mergedFields.findIndex((f) => f.id === def.id || f.key === def.key);
          if (idx === -1) {
            mergedFields.push(def);
          } else if (def.isProtected) {
            // Keep protected settings enforced
            mergedFields[idx] = {
              ...mergedFields[idx],
              isProtected: true,
              protectedReason: def.protectedReason,
              required: true,
              enabled: true,
            };
          }
        }

        return {
          id: `config_${formType.toLowerCase()}`,
          formType,
          fields: mergedFields,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };
      }
    }
  } catch {
    // ignore
  }

  const initialConfig: FormConfiguration = {
    id: `config_${formType.toLowerCase()}`,
    formType,
    fields: getDefaultsForType(formType),
    updatedAt: new Date().toISOString(),
  };

  try {
    safeStorage.setItem(key, JSON.stringify(initialConfig));
  } catch {
    // ignore
  }

  return initialConfig;
}

function saveLocalConfig(config: FormConfiguration): void {
  const key = `${FORM_CONFIG_STORAGE_PREFIX}${config.formType.toLowerCase()}`;
  try {
    safeStorage.setItem(key, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export const formConfigService = {
  /**
   * Retrieve active form configuration for a given form type.
   */
  async getFormConfig(formType: FormConfigType): Promise<FormConfiguration> {
    const configId = `config_${formType.toLowerCase()}`;
    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'formConfigurations', configId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const remote = snap.data() as FormConfiguration;
          if (remote && Array.isArray(remote.fields)) {
            // Re-enforce protected fields
            const defaults = getDefaultsForType(formType);
            let rawFields = remote.fields;
            if (formType === 'FACULTY') {
              rawFields = rawFields.filter((f) => f.key !== 'department' && f.id !== 'field_fac_department');
            }
            const fields = rawFields.map((f) => {
              const def = defaults.find((d) => d.id === f.id || d.key === f.key);
              if (def?.isProtected) {
                return {
                  ...f,
                  isProtected: true,
                  protectedReason: def.protectedReason,
                  required: true,
                  enabled: true,
                };
              }
              return f;
            });

            // Ensure any missing defaults are added
            for (const def of defaults) {
              if (!fields.some((f) => f.id === def.id || f.key === def.key)) {
                fields.push(def);
              }
            }

            const updated: FormConfiguration = {
              ...remote,
              fields,
            };
            saveLocalConfig(updated);
            return updated;
          }
        }
      } catch (err) {
        console.warn(`Firestore getFormConfig failed for ${formType}, fallback to local:`, err);
      }
    }
    return getLocalConfig(formType);
  },

  /**
   * Save entire form configuration
   */
  async saveFormConfig(
    config: FormConfiguration,
    actor?: { uid: string; name: string; role: UserRole }
  ): Promise<{ success: boolean; config?: FormConfiguration; error?: string }> {
    const defaults = getDefaultsForType(config.formType);

    // Enforce protection on security-critical fields
    const sanitizedFields = config.fields.map((f) => {
      const def = defaults.find((d) => d.id === f.id || d.key === f.key);
      if (def?.isProtected) {
        return {
          ...f,
          isProtected: true,
          protectedReason: def.protectedReason,
          required: true,
          enabled: true,
        };
      }
      return f;
    });

    const finalConfig: FormConfiguration = {
      ...config,
      fields: sanitizedFields,
      updatedAt: new Date().toISOString(),
    };

    saveLocalConfig(finalConfig);

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'formConfigurations', finalConfig.id), finalConfig);
      } catch (err) {
        console.warn('Firestore saveFormConfig fallback:', err);
      }
    }

    if (actor) {
      try {
        await auditService.logAction({
          action: 'UPDATE',
          entityType: 'FormConfiguration',
          entityId: finalConfig.id,
          actorId: actor.uid,
          actorName: actor.name,
          actorRole: actor.role,
          changes: `Updated form field configuration for ${finalConfig.formType} (${finalConfig.fields.length} fields).`,
        });
      } catch {
        // ignore
      }
    }

    return { success: true, config: finalConfig };
  },

  /**
   * Add a new custom field to a form configuration
   */
  async addCustomField(
    formType: FormConfigType,
    fieldDef: Omit<FormFieldDefinition, 'id' | 'order' | 'isCustom' | 'isProtected'>,
    actor?: { uid: string; name: string; role: UserRole }
  ): Promise<{ success: boolean; config?: FormConfiguration; error?: string }> {
    const trimmedLabel = fieldDef.label.trim();
    if (!trimmedLabel) {
      return { success: false, error: 'Field Label / Name is required.' };
    }

    if (fieldDef.type === 'dropdown') {
      if (!fieldDef.options || fieldDef.options.length === 0) {
        return { success: false, error: 'At least one option is required for Dropdown fields.' };
      }
    }

    const currentConfig = await this.getFormConfig(formType);
    const existingSameLabel = currentConfig.fields.some(
      (f) => f.label.toLowerCase() === trimmedLabel.toLowerCase() && f.enabled
    );
    if (existingSameLabel) {
      return { success: false, error: `A field named "${trimmedLabel}" already exists.` };
    }

    const newFieldId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newFieldKey = fieldDef.key || trimmedLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const newField: FormFieldDefinition = {
      ...fieldDef,
      id: newFieldId,
      key: newFieldKey,
      label: trimmedLabel,
      enabled: true,
      isCustom: true,
      isProtected: false,
      order: currentConfig.fields.length + 1,
    };

    const updatedConfig: FormConfiguration = {
      ...currentConfig,
      fields: [...currentConfig.fields, newField],
      updatedAt: new Date().toISOString(),
    };

    return this.saveFormConfig(updatedConfig, actor);
  },

  /**
   * Update existing field definition (Requirement, options, scope, etc.)
   */
  async updateField(
    formType: FormConfigType,
    fieldId: string,
    updates: Partial<FormFieldDefinition>,
    actor?: { uid: string; name: string; role: UserRole }
  ): Promise<{ success: boolean; config?: FormConfiguration; error?: string }> {
    const currentConfig = await this.getFormConfig(formType);
    const idx = currentConfig.fields.findIndex((f) => f.id === fieldId);
    if (idx === -1) {
      return { success: false, error: 'Field not found in configuration.' };
    }

    const target = currentConfig.fields[idx];

    // Protect immutable settings on core fields
    if (target.isProtected) {
      if (updates.required === false) {
        return {
          success: false,
          error: `Field "${target.label}" is required by the system (${target.protectedReason}) and cannot be made optional.`,
        };
      }
      if (updates.enabled === false) {
        return {
          success: false,
          error: `Field "${target.label}" is protected (${target.protectedReason}) and cannot be removed.`,
        };
      }
    }

    currentConfig.fields[idx] = {
      ...target,
      ...updates,
    };

    return this.saveFormConfig(currentConfig, actor);
  },

  /**
   * Remove a field (marks it disabled/hidden)
   */
  async removeField(
    formType: FormConfigType,
    fieldId: string,
    actor?: { uid: string; name: string; role: UserRole }
  ): Promise<{ success: boolean; config?: FormConfiguration; error?: string }> {
    const currentConfig = await this.getFormConfig(formType);
    const target = currentConfig.fields.find((f) => f.id === fieldId);
    if (!target) {
      return { success: false, error: 'Field not found in configuration.' };
    }

    if (target.isProtected) {
      return {
        success: false,
        error: `Field "${target.label}" is a protected system field (${target.protectedReason}) and cannot be removed.`,
      };
    }

    // Set enabled to false so existing data is preserved, but field is hidden from forms
    return this.updateField(formType, fieldId, { enabled: false }, actor);
  },

  /**
   * Restore all default fields for a form type
   */
  async restoreDefaults(
    formType: FormConfigType,
    actor?: { uid: string; name: string; role: UserRole }
  ): Promise<{ success: boolean; config?: FormConfiguration }> {
    const defaults = getDefaultsForType(formType);
    const currentConfig = await this.getFormConfig(formType);

    // Keep custom fields that user added, but restore all core defaults
    const customFields = currentConfig.fields.filter((f) => f.isCustom);
    const restoredConfig: FormConfiguration = {
      id: `config_${formType.toLowerCase()}`,
      formType,
      fields: [...defaults, ...customFields],
      updatedAt: new Date().toISOString(),
    };

    return this.saveFormConfig(restoredConfig, actor);
  },

  /**
   * Check if a field applies to a given user based on scope
   */
  isFieldApplicable(field: FormFieldDefinition, targetUser?: { uid?: string; email?: string } | null): boolean {
    if (!field.enabled) return false;
    if (field.scope === 'ALL') return true;

    // 'SELECTED' scope
    if (!targetUser) {
      // For adding a new user, 'SELECTED' custom fields are not shown by default unless user is pre-selected
      return false;
    }

    const list = field.selectedUserIds || [];
    if (targetUser.uid && list.includes(targetUser.uid)) return true;
    if (targetUser.email && list.some((id) => id.toLowerCase() === targetUser.email?.toLowerCase())) return true;

    return false;
  },

  /**
   * Validate form values against required configured fields
   */
  validateFormValues(
    formConfig: FormConfiguration,
    coreValues: Record<string, any>,
    customValues: Record<string, any>,
    targetUser?: { uid?: string; email?: string } | null
  ): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    for (const field of formConfig.fields) {
      if (!field.enabled) continue;
      if (!this.isFieldApplicable(field, targetUser)) continue;

      if (field.required) {
        let val: any;
        if (field.isCustom) {
          val = customValues[field.id] ?? customValues[field.key];
        } else {
          val = coreValues[field.key];
        }

        const isEmpty =
          val === undefined ||
          val === null ||
          (typeof val === 'string' && val.trim() === '') ||
          (Array.isArray(val) && val.length === 0);

        if (isEmpty) {
          errors[field.isCustom ? field.id : field.key] = `${field.label} is required.`;
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  },
};
