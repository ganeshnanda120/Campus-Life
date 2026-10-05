import React, { useState, useEffect, useCallback, useId } from 'react';
import {
  ShieldAlert,
  Search,
  Plus,
  Edit2,
  UserX,
  UserCheck,
  Eye,
  RefreshCw,
  Key,
  Shield,
  Settings2,
} from 'lucide-react';
import { StatCard, Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { Skeleton } from '../../components/common/Skeleton';
import { Alert } from '../../components/common/Alert';
import { CustomFieldsRenderer } from '../../components/common/CustomFieldsRenderer';
import { FormFieldConfigModal } from '../../components/common/FormFieldConfigModal';
import { AddCustomFieldModal } from '../../components/common/AddCustomFieldModal';
import { useAuth } from '../../context/useAuth';
import { userService } from '../../services/userService';
import { formConfigService, DEFAULT_SUB_ADMIN_FIELDS } from '../../services/formConfigService';
import {
  ALL_PERMISSIONS,
} from '../../services/permissionService';
import { PermissionCatalogModal } from '../../components/common/PermissionCatalogModal';
import { PermissionManagerModal } from '../../components/common/PermissionManagerModal';
import type { UserRecord, UserPermission, FormConfiguration } from '../../types';

export const SubAdminManagementPage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const searchInputId = useId();

  // Data States
  const [subAdmins, setSubAdmins] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false);

  const [selectedAdmin, setSelectedAdmin] = useState<UserRecord | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<UserPermission[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Field Configuration State
  const [formConfig, setFormConfig] = useState<FormConfiguration>({
    id: 'config_sub_admin',
    formType: 'SUB_ADMIN',
    fields: DEFAULT_SUB_ADMIN_FIELDS,
    updatedAt: '',
  });
  const [isFieldConfigModalOpen, setIsFieldConfigModalOpen] = useState(false);
  const [isAddCustomFieldModalOpen, setIsAddCustomFieldModalOpen] = useState(false);
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({});

  // Load sub-admin form configuration
  const loadFormConfig = useCallback(async () => {
    try {
      const cfg = await formConfigService.getFormConfig('SUB_ADMIN');
      if (cfg) setFormConfig(cfg);
    } catch (err) {
      console.warn('Failed to load sub-admin form config:', err);
    }
  }, []);

  useEffect(() => {
    loadFormConfig();
  }, [loadFormConfig]);

  const isFieldEnabled = (key: string) => {
    const f = formConfig.fields.find((field) => field.key === key);
    return f ? f.enabled !== false : true;
  };

  const isFieldRequired = (key: string) => {
    const f = formConfig.fields.find((field) => field.key === key);
    return f ? f.required === true : false;
  };

  const handleCustomFieldChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [fieldId]: value,
      },
    }));
    setCustomFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy[fieldId];
      return copy;
    });
  };

  // Form State
  const initialFormData = {
    name: '',
    email: '',
    department: 'Hostel Operations',
    designation: 'Hostel Warden',
    phone: '',
    employeeId: '',
    customFields: {} as Record<string, any>,
  };
  const [formData, setFormData] = useState(initialFormData);

  // Fetch Sub-Admins
  const loadSubAdmins = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await userService.queryUsers({
        role: 'SUB_ADMIN',
        searchQuery,
        status: statusFilter,
        sortBy: 'name',
        sortOrder: 'asc',
        pageSize: 50,
      });
      setSubAdmins(res.users);
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve sub-administrator records.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    loadSubAdmins();
  }, [loadSubAdmins]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setFormData(initialFormData);
    setSelectedPermissions([]);
    setCustomFieldErrors({});
    setModalError(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (admin: UserRecord) => {
    setSelectedAdmin(admin);
    setFormData({
      name: admin.name || '',
      email: admin.email || '',
      department: admin.department || '',
      designation: admin.designation || '',
      phone: admin.phone || '',
      employeeId: admin.employeeId || '',
      customFields: admin.customFields || {},
    });
    setCustomFieldErrors({});
    setModalError(null);
    setIsEditModalOpen(true);
  };

  // Open Permission Matrix Modal
  const handleOpenPermissions = (admin: UserRecord) => {
    setSelectedAdmin(admin);
    setSelectedPermissions(admin.permissions || []);
    setModalError(null);
    setIsPermModalOpen(true);
  };

  // Open View Details Modal
  const handleOpenView = (admin: UserRecord) => {
    setSelectedAdmin(admin);
    setIsViewModalOpen(true);
  };

  // Open Deactivate Confirmation Modal
  const handleOpenDeactivate = (admin: UserRecord) => {
    setSelectedAdmin(admin);
    setIsDeactivateModalOpen(true);
  };

  // Open Reactivate Confirmation Modal
  const handleOpenReactivate = (admin: UserRecord) => {
    setSelectedAdmin(admin);
    setIsReactivateModalOpen(true);
  };

  // Submit Add Sub-Admin
  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setCustomFieldErrors({});

    // Dynamic configuration-driven validation
    const validation = formConfigService.validateFormValues(
      formConfig,
      formData,
      formData.customFields || {},
      null
    );

    if (!validation.valid) {
      setCustomFieldErrors(validation.errors);
      const firstError = Object.values(validation.errors)[0];
      setModalError(firstError || 'Please complete all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const actor = {
        uid: userProfile?.uid || 'admin',
        name: userProfile?.name || 'Administrator',
        role: role || 'MAIN_ADMIN',
      };

      const res = await userService.createUser(
        {
          role: 'SUB_ADMIN',
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          department: formData.department.trim(),
          designation: formData.designation.trim(),
          phone: formData.phone.trim() || undefined,
          employeeId: formData.employeeId.trim() || undefined,
          permissions: selectedPermissions,
          customFields: formData.customFields || {},
        },
        actor
      );

      if (!res.success) {
        setModalError(res.error || 'Failed to create sub-admin.');
        setIsSubmitting(false);
        return;
      }

      setIsAddModalOpen(false);
      setToastMessage(`Sub-Admin record created for ${formData.name}.`);
      setTimeout(() => setToastMessage(null), 5000);
      loadSubAdmins();
    } catch (err: any) {
      setModalError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Sub-Admin
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin) return;
    setModalError(null);
    setCustomFieldErrors({});

    // Dynamic configuration-driven validation
    const validation = formConfigService.validateFormValues(
      formConfig,
      formData,
      formData.customFields || {},
      selectedAdmin
    );

    if (!validation.valid) {
      setCustomFieldErrors(validation.errors);
      const firstError = Object.values(validation.errors)[0];
      setModalError(firstError || 'Please complete all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const actor = {
        uid: userProfile?.uid || 'admin',
        name: userProfile?.name || 'Administrator',
        role: role || 'MAIN_ADMIN',
      };

      const res = await userService.updateUser(
        selectedAdmin.uid,
        {
          name: formData.name.trim(),
          department: formData.department.trim(),
          designation: formData.designation.trim(),
          phone: formData.phone.trim() || undefined,
          employeeId: formData.employeeId.trim() || undefined,
          customFields: formData.customFields || {},
        },
        actor
      );

      if (!res.success) {
        setModalError(res.error || 'Failed to update sub-admin profile.');
        setIsSubmitting(false);
        return;
      }

      setIsEditModalOpen(false);
      setToastMessage(`Sub-Admin updated: ${formData.name}`);
      setTimeout(() => setToastMessage(null), 5000);
      loadSubAdmins();
    } catch (err: any) {
      setModalError(err.message || 'Failed to update profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Deactivate
  const handleConfirmDeactivate = async () => {
    if (!selectedAdmin) return;
    setIsSubmitting(true);
    try {
      const actor = {
        uid: userProfile?.uid || 'admin',
        name: userProfile?.name || 'Administrator',
        role: role || 'MAIN_ADMIN',
      };

      const res = await userService.deactivateUser(
        selectedAdmin.uid,
        actor,
        'Administrative Deactivation of Sub-Admin'
      );
      if (res.success) {
        setIsDeactivateModalOpen(false);
        setToastMessage(`Account for ${selectedAdmin.name} deactivated.`);
        setTimeout(() => setToastMessage(null), 5000);
        loadSubAdmins();
      } else {
        alert(res.error || 'Failed to deactivate account.');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred during deactivation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reactivate
  const handleConfirmReactivate = async () => {
    if (!selectedAdmin) return;
    setIsSubmitting(true);
    try {
      const actor = {
        uid: userProfile?.uid || 'admin',
        name: userProfile?.name || 'Administrator',
        role: role || 'MAIN_ADMIN',
      };

      const res = await userService.reactivateUser(selectedAdmin.uid, actor);
      if (res.success) {
        setIsReactivateModalOpen(false);
        setToastMessage(`Account access restored for ${selectedAdmin.name}.`);
        setTimeout(() => setToastMessage(null), 5000);
        loadSubAdmins();
      } else {
        alert(res.error || 'Failed to reactivate account.');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred during reactivation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCount = subAdmins.filter((s) => s.isActive).length;
  const inactiveCount = subAdmins.filter((s) => !s.isActive).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%' }}>
      {toastMessage && (
        <Alert variant="success" title="Success" dismissible onDismiss={() => setToastMessage(null)}>
          {toastMessage}
        </Alert>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Sub-Admin Management & Permissions</h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Delegate granular administrative responsibilities across campus modules without granting full root privileges.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {role === 'MAIN_ADMIN' && (
            <Button
              variant="outline"
              leftIcon={<Settings2 size={16} />}
              onClick={() => setIsFieldConfigModalOpen(true)}
            >
              Configure Fields
            </Button>
          )}
          <Button variant="primary" leftIcon={<Plus size={16} />} onClick={handleOpenAdd}>
            Add Sub-Admin
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid-cards-4">
        <StatCard
          label="Total Sub-Admins"
          value={subAdmins.length}
          subtitle="Delegated administrators"
          icon={<ShieldAlert size={22} />}
        />
        <StatCard
          label="Active Sub-Admins"
          value={activeCount}
          subtitle="Operational staff with access"
          icon={<Shield size={22} />}
        />
        <StatCard
          label="Granular Permissions"
          value={ALL_PERMISSIONS.length}
          subtitle="Module-level capabilities"
          icon={<Key size={22} />}
          onClick={() => setIsCatalogModalOpen(true)}
        />
        <StatCard
          label="Deactivated"
          value={inactiveCount}
          subtitle={inactiveCount > 0 ? 'Access suspended' : 'No suspended accounts'}
          icon={<UserX size={22} />}
        />
      </div>

      {/* Filter Toolbar */}
      <Card>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 280px', position: 'relative' }}>
            <label htmlFor={searchInputId} style={{ display: 'none' }}>
              Search sub-admins
            </label>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
              }}
            />
            <input
              id={searchInputId}
              type="text"
              className="input-field"
              placeholder="Search by name, email, department, designation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem', width: '100%' }}
            />
          </div>

          <div style={{ width: '150px' }}>
            <select
              aria-label="Filter sub-admins by status"
              className="input-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw size={14} className={isLoading ? 'spin' : ''} />}
            onClick={loadSubAdmins}
          >
            Refresh
          </Button>
        </div>
      </Card>

      {/* Sub-Admins List */}
      <Card>
        {error && (
          <Alert variant="danger" title="Error">
            {error}
          </Alert>
        )}

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 0' }}>
            <Skeleton height="40px" />
            <Skeleton height="40px" />
            <Skeleton height="40px" />
          </div>
        ) : subAdmins.length === 0 ? (
          <EmptyState
            title="No Sub-Admins Found"
            description="No delegated administrators match your search filter. Create a Sub-Admin using the button above."
            icon={<ShieldAlert size={40} />}
          />
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="table-responsive hide-on-mobile">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sub-Admin</th>
                    <th>Role & Department</th>
                    <th>Assigned Permissions</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subAdmins.map((admin) => (
                    <tr key={admin.uid}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{admin.name}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{admin.email}</span>
                          {admin.phone && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{admin.phone}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                            {admin.designation || 'Delegated Admin'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {admin.department || 'Administration'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', maxWidth: '350px' }}>
                          {(admin.permissions || []).length === 0 ? (
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                              No permissions assigned
                            </span>
                          ) : (
                            admin.permissions?.slice(0, 3).map((p) => (
                              <Badge key={p} variant="info" style={{ fontSize: '0.7rem' }}>
                                {p.replace('MANAGE_', '').replace('VIEW_', '')}
                              </Badge>
                            ))
                          )}
                          {(admin.permissions || []).length > 3 && (
                            <Badge variant="neutral" style={{ fontSize: '0.7rem' }}>
                              +{admin.permissions!.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {admin.isActive ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="danger">Inactive</Badge>
                          )}
                          {!admin.isActivated && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-warning)' }}>
                              Setup Pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Key size={14} />}
                            onClick={() => handleOpenPermissions(admin)}
                          >
                            Permissions
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`View details for ${admin.name}`}
                            onClick={() => handleOpenView(admin)}
                          >
                            <Eye size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${admin.name}`}
                            onClick={() => handleOpenEdit(admin)}
                          >
                            <Edit2 size={15} />
                          </Button>
                          {admin.isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Deactivate ${admin.name}`}
                              style={{ color: 'var(--color-danger)' }}
                              onClick={() => handleOpenDeactivate(admin)}
                            >
                              <UserX size={15} />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Reactivate ${admin.name}`}
                              style={{ color: 'var(--color-success)' }}
                              onClick={() => handleOpenReactivate(admin)}
                            >
                              <UserCheck size={15} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="show-on-mobile mobile-card-list">
              {subAdmins.map((admin) => (
                <div
                  key={admin.uid}
                  style={{
                    padding: '1rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem' }}>{admin.name}</h4>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{admin.email}</div>
                    </div>
                    {admin.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="danger">Inactive</Badge>
                    )}
                  </div>

                  <div style={{ fontSize: '0.85rem' }}>
                    <strong>{admin.designation || 'Delegated Admin'}</strong> • {admin.department || 'Administration'}
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                      Permissions ({(admin.permissions || []).length}):
                    </span>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {(admin.permissions || []).length === 0 ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                          No permissions assigned
                        </span>
                      ) : (
                        admin.permissions?.map((p) => (
                          <Badge key={p} variant="info" style={{ fontSize: '0.7rem' }}>
                            {p.replace('MANAGE_', '').replace('VIEW_', '')}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      justifyContent: 'flex-end',
                      borderTop: '1px solid var(--color-border)',
                      paddingTop: '0.75rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <Button variant="primary" size="sm" leftIcon={<Key size={14} />} onClick={() => handleOpenPermissions(admin)}>
                      Permissions
                    </Button>
                    <Button variant="outline" size="sm" leftIcon={<Eye size={14} />} onClick={() => handleOpenView(admin)}>
                      View
                    </Button>
                    <Button variant="outline" size="sm" leftIcon={<Edit2 size={14} />} onClick={() => handleOpenEdit(admin)}>
                      Edit
                    </Button>
                    {admin.isActive ? (
                      <Button
                        variant="outline"
                        size="sm"
                        style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                        leftIcon={<UserX size={14} />}
                        onClick={() => handleOpenDeactivate(admin)}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                        leftIcon={<UserCheck size={14} />}
                        onClick={() => handleOpenReactivate(admin)}
                      >
                        Reactivate
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* PERMISSION MANAGER MODAL (Granular Capabilities)                          */}
      {/* ========================================================================= */}
      <PermissionManagerModal
        isOpen={isPermModalOpen}
        onClose={() => {
          setIsPermModalOpen(false);
          setSelectedAdmin(null);
        }}
        targetUser={selectedAdmin}
        onSavePermissions={async (newPermissions) => {
          if (!selectedAdmin) return;
          const actor = {
            uid: userProfile?.uid || 'admin',
            name: userProfile?.name || 'Administrator',
            role: role || 'MAIN_ADMIN',
          };

          const res = await userService.updateUserPermissions(
            selectedAdmin.uid,
            newPermissions,
            actor
          );

          if (!res.success) {
            throw new Error(res.error || 'Failed to update permissions.');
          }

          setIsPermModalOpen(false);
          setSelectedAdmin(null);
          setToastMessage(`Permissions updated successfully for ${selectedAdmin.name}.`);
          setTimeout(() => setToastMessage(null), 5000);
          loadSubAdmins();
        }}
      />

      {/* ========================================================================= */}
      {/* PERMISSION CATALOG MODAL (Dynamic 26-Capability Directory)                */}
      {/* ========================================================================= */}
      <PermissionCatalogModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
      />

      {/* ========================================================================= */}
      {/* ADD SUB-ADMIN MODAL                                                       */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Sub-Admin"
        size="normal"
      >
        <form onSubmit={handleSubmitAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {modalError && (
            <Alert variant="danger" title="Validation Error">
              {modalError}
            </Alert>
          )}

          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <strong>Security Rule:</strong> Newly created Sub-Admins have <code>isActive = true</code> and <code>isActivated = false</code>. They complete activation on first login. Permissions must be explicitly delegated by the MAIN_ADMIN.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label className="input-label" htmlFor="sub-name">Full Name *</label>
              <input
                id="sub-name"
                type="text"
                required
                className="input-field"
                placeholder="e.g. Prof. Rajesh Swain"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="input-label" htmlFor="sub-email">Email Address *</label>
              <input
                id="sub-email"
                type="email"
                required
                className="input-field"
                placeholder="e.g. rajesh.swain@campuslife.edu"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            {isFieldEnabled('department') && (
              <div>
                <label className="input-label" htmlFor="sub-dept">
                  Department{isFieldRequired('department') ? ' *' : ''}
                </label>
                <input
                  id="sub-dept"
                  type="text"
                  required={isFieldRequired('department')}
                  className="input-field"
                  placeholder="e.g. Hostel Operations"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
            )}

            {isFieldEnabled('designation') && (
              <div>
                <label className="input-label" htmlFor="sub-desig">
                  Designation{isFieldRequired('designation') ? ' *' : ''}
                </label>
                <input
                  id="sub-desig"
                  type="text"
                  required={isFieldRequired('designation')}
                  className="input-field"
                  placeholder="e.g. Boys Hostel Warden"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                />
              </div>
            )}

            {isFieldEnabled('phone') && (
              <div>
                <label className="input-label" htmlFor="sub-phone">
                  Phone Number{isFieldRequired('phone') ? ' *' : ''}
                </label>
                <input
                  id="sub-phone"
                  type="tel"
                  required={isFieldRequired('phone')}
                  className="input-field"
                  placeholder="+91 98765 00000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            )}

            {isFieldEnabled('employeeId') && (
              <div>
                <label className="input-label" htmlFor="sub-empid">
                  Employee / Staff ID{isFieldRequired('employeeId') ? ' *' : ''}
                </label>
                <input
                  id="sub-empid"
                  type="text"
                  required={isFieldRequired('employeeId')}
                  className="input-field"
                  placeholder="e.g. ADM202601"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* Custom Details Section */}
          <CustomFieldsRenderer
            fields={formConfig.fields}
            values={formData.customFields || {}}
            errors={customFieldErrors}
            onChange={handleCustomFieldChange}
            targetUser={null}
            onOpenAddField={() => setIsAddCustomFieldModalOpen(true)}
            onOpenConfigureFields={() => setIsFieldConfigModalOpen(true)}
            canManage={role === 'MAIN_ADMIN'}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <Button variant="ghost" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Create Sub-Admin
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* EDIT SUB-ADMIN MODAL                                                      */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Sub-Admin — ${selectedAdmin?.name}`}
        size="normal"
      >
        <form onSubmit={handleSubmitEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {modalError && (
            <Alert variant="danger" title="Validation Error">
              {modalError}
            </Alert>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label className="input-label" htmlFor="sub-edit-name">Full Name *</label>
              <input
                id="sub-edit-name"
                type="text"
                required
                className="input-field"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="input-label" htmlFor="sub-edit-email">Email (Immutable)</label>
              <input
                id="sub-edit-email"
                type="email"
                disabled
                className="input-field"
                value={formData.email}
                style={{ opacity: 0.7, cursor: 'not-allowed' }}
              />
            </div>

            {isFieldEnabled('department') && (
              <div>
                <label className="input-label" htmlFor="sub-edit-dept">
                  Department{isFieldRequired('department') ? ' *' : ''}
                </label>
                <input
                  id="sub-edit-dept"
                  type="text"
                  required={isFieldRequired('department')}
                  className="input-field"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
            )}

            {isFieldEnabled('designation') && (
              <div>
                <label className="input-label" htmlFor="sub-edit-desig">
                  Designation{isFieldRequired('designation') ? ' *' : ''}
                </label>
                <input
                  id="sub-edit-desig"
                  type="text"
                  required={isFieldRequired('designation')}
                  className="input-field"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                />
              </div>
            )}

            {isFieldEnabled('phone') && (
              <div>
                <label className="input-label" htmlFor="sub-edit-phone">
                  Phone Number{isFieldRequired('phone') ? ' *' : ''}
                </label>
                <input
                  id="sub-edit-phone"
                  type="tel"
                  required={isFieldRequired('phone')}
                  className="input-field"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            )}

            {isFieldEnabled('employeeId') && (
              <div>
                <label className="input-label" htmlFor="sub-edit-empid">
                  Employee ID{isFieldRequired('employeeId') ? ' *' : ''}
                </label>
                <input
                  id="sub-edit-empid"
                  type="text"
                  required={isFieldRequired('employeeId')}
                  className="input-field"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* Custom Details Section */}
          <CustomFieldsRenderer
            fields={formConfig.fields}
            values={formData.customFields || {}}
            errors={customFieldErrors}
            onChange={handleCustomFieldChange}
            targetUser={selectedAdmin}
            onOpenAddField={() => setIsAddCustomFieldModalOpen(true)}
            onOpenConfigureFields={() => setIsFieldConfigModalOpen(true)}
            canManage={role === 'MAIN_ADMIN'}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <Button variant="ghost" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Save Profile
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* VIEW SUB-ADMIN DETAILS MODAL                                              */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Sub-Administrator Profile"
        size="normal"
      >
        {selectedAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {selectedAdmin.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem' }}>{selectedAdmin.name}</h3>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <Badge variant={selectedAdmin.isActive ? 'success' : 'danger'}>
                    {selectedAdmin.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="info">SUB_ADMIN</Badge>
                  {!selectedAdmin.isActivated && (
                    <Badge variant="warning">First-Time Setup Pending</Badge>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Email Address</span>
                <strong>{selectedAdmin.email}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Employee ID</span>
                <strong style={{ fontFamily: 'monospace' }}>{selectedAdmin.employeeId || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Department</span>
                <strong>{selectedAdmin.department || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Designation</span>
                <strong>{selectedAdmin.designation || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Phone</span>
                <strong>{selectedAdmin.phone || 'N/A'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Account Created</span>
                <span>{new Date(selectedAdmin.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}>
                Delegated Permissions ({(selectedAdmin.permissions || []).length}):
              </span>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {(selectedAdmin.permissions || []).length === 0 ? (
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    No permissions assigned. This sub-admin cannot perform operational operations.
                  </span>
                ) : (
                  selectedAdmin.permissions?.map((p) => (
                    <Badge key={p} variant="info">
                      {p}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {selectedAdmin.customFields && Object.keys(selectedAdmin.customFields).length > 0 && (
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>Additional / Custom Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                  {Object.entries(selectedAdmin.customFields).map(([key, val]) => {
                    const fieldDef = formConfig.fields.find((f) => f.id === key);
                    const label = fieldDef?.label || key;
                    const displayVal = val === true ? 'Yes' : val === false ? 'No' : String(val || '—');
                    return (
                      <div key={key}>
                        <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>{label}</span>
                        <strong>{displayVal}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
              <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* DEACTIVATE CONFIRMATION MODAL                                             */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDeactivateModalOpen}
        onClose={() => setIsDeactivateModalOpen(false)}
        title="Deactivate Sub-Admin?"
        size="normal"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-main)' }}>
            The sub-admin will no longer be able to access Campus Life.
          </p>

          <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
            <div><strong>Sub-Admin:</strong> {selectedAdmin?.name}</div>
            <div><strong>Email:</strong> {selectedAdmin?.email}</div>
            <div><strong>Designation:</strong> {selectedAdmin?.designation}</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <Button variant="ghost" onClick={() => setIsDeactivateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              isLoading={isSubmitting}
              onClick={handleConfirmDeactivate}
            >
              Deactivate
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* REACTIVATE CONFIRMATION MODAL                                             */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isReactivateModalOpen}
        onClose={() => setIsReactivateModalOpen(false)}
        title="Reactivate Sub-Admin?"
        size="normal"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-main)' }}>
            This will restore Campus Life access for this account.
          </p>

          <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
            <div><strong>Sub-Admin:</strong> {selectedAdmin?.name}</div>
            <div><strong>Email:</strong> {selectedAdmin?.email}</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <Button variant="ghost" onClick={() => setIsReactivateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}
              isLoading={isSubmitting}
              onClick={handleConfirmReactivate}
            >
              Reactivate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Form Field Configuration Modal */}
      <FormFieldConfigModal
        isOpen={isFieldConfigModalOpen}
        onClose={() => setIsFieldConfigModalOpen(false)}
        formType="SUB_ADMIN"
        config={formConfig}
        onConfigUpdated={(newCfg) => setFormConfig(newCfg)}
        onOpenAddCustomField={() => setIsAddCustomFieldModalOpen(true)}
        actor={{
          uid: userProfile?.uid || 'admin',
          name: userProfile?.name || 'Administrator',
          role: role || 'MAIN_ADMIN',
        }}
      />

      {/* Add Custom Field Modal */}
      <AddCustomFieldModal
        isOpen={isAddCustomFieldModalOpen}
        onClose={() => setIsAddCustomFieldModalOpen(false)}
        formType="SUB_ADMIN"
        availableUsers={subAdmins}
        onSave={async (fieldDef) => {
          const res = await formConfigService.addCustomField('SUB_ADMIN', fieldDef, {
            uid: userProfile?.uid || 'admin',
            name: userProfile?.name || 'Administrator',
            role: role || 'MAIN_ADMIN',
          });
          if (res.success && res.config) {
            setFormConfig(res.config);
            setToastMessage(`Custom field "${fieldDef.label}" added successfully.`);
            setTimeout(() => setToastMessage(null), 4000);
            return true;
          }
          alert(res.error || 'Failed to add custom field.');
          return false;
        }}
      />
    </div>
  );
};
