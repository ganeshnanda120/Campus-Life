import React, { useState, useEffect, useCallback, useId } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  UserCheck,
  Search,
  Plus,
  Edit2,
  UserX,
  Eye,
  RefreshCw,
  Building,
  GraduationCap,
  Wrench,
  CheckCircle,
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
import { formConfigService, DEFAULT_FACULTY_FIELDS } from '../../services/formConfigService';
import type { UserRecord, UserRole, FormConfiguration } from '../../types';

interface FacultyManagementProps {
  initialTab?: 'faculty' | 'staff';
}

const ACADEMIC_DEPARTMENTS = [
  'Computer Science & Engineering',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Electronics & Telecommunication',
  'Information Technology',
  'Basic Sciences & Humanities',
];

const OPERATIONAL_DEPARTMENTS = [
  'Estate & Maintenance',
  'Hostel Operations',
  'Mess & Dining Services',
  'Campus Security & Surveillance',
  'IT Infrastructure & Systems',
  'Health Center & Medical Services',
  'Library & Information Services',
  'Accounts & Administrative Office',
];

export const FacultyManagementPage: React.FC<FacultyManagementProps> = ({ initialTab = 'faculty' }) => {
  const { userProfile, role } = useAuth();
  const searchInputId = useId();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab State: 'faculty' or 'staff'
  const currentTab = (searchParams.get('tab') as 'faculty' | 'staff') || initialTab;
  const setTab = (tab: 'faculty' | 'staff') => {
    setSearchParams({ tab });
  };

  // Data States
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Counters
  const [stats, setStats] = useState({
    facultyTotal: 0,
    facultyActive: 0,
    staffTotal: 0,
    staffActive: 0,
  });

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Field Configuration State
  const [formConfig, setFormConfig] = useState<FormConfiguration>({
    id: 'config_faculty',
    formType: 'FACULTY',
    fields: DEFAULT_FACULTY_FIELDS,
    updatedAt: '',
  });
  const [isFieldConfigModalOpen, setIsFieldConfigModalOpen] = useState(false);
  const [isAddCustomFieldModalOpen, setIsAddCustomFieldModalOpen] = useState(false);
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({});

  // Load faculty form configuration
  const loadFormConfig = useCallback(async () => {
    try {
      const cfg = await formConfigService.getFormConfig('FACULTY');
      if (cfg) setFormConfig(cfg);
    } catch (err) {
      console.warn('Failed to load faculty form config:', err);
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
    employeeId: '',
    department: ACADEMIC_DEPARTMENTS[0],
    designation: 'Assistant Professor',
    branch: 'CSE',
    officeLocation: '',
    phone: '',
    customFields: {} as Record<string, any>,
  };
  const [formData, setFormData] = useState(initialFormData);

  // Fetch KPI Stats
  const fetchStats = useCallback(async () => {
    try {
      const all = await userService.getAllUsers();
      const fList = all.filter((u) => u.role === 'FACULTY');
      const sList = all.filter((u) => u.role === 'STAFF');

      setStats({
        facultyTotal: fList.length,
        facultyActive: fList.filter((u) => u.isActive).length,
        staffTotal: sList.length,
        staffActive: sList.filter((u) => u.isActive).length,
      });
    } catch (err) {
      console.warn('Failed to load faculty/staff stats:', err);
    }
  }, []);

  // Fetch User records for current tab
  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const targetRole: UserRole = currentTab === 'faculty' ? 'FACULTY' : 'STAFF';
      const res = await userService.queryUsers({
        role: targetRole,
        searchQuery,
        department: deptFilter === 'ALL' ? undefined : deptFilter,
        status: statusFilter,
        sortBy: 'name',
        sortOrder: 'asc',
        pageSize: 50,
      });

      setUsersList(res.users);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch directory records.');
    } finally {
      setIsLoading(false);
    }
  }, [currentTab, searchQuery, deptFilter, statusFilter]);

  useEffect(() => {
    loadRecords();
    fetchStats();
  }, [loadRecords, fetchStats]);

  // Handle Tab Switch
  const handleTabChange = (newTab: 'faculty' | 'staff') => {
    setTab(newTab);
    setSearchQuery('');
    setDeptFilter('ALL');
    setStatusFilter('all');
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setFormData({
      name: '',
      email: '',
      employeeId: '',
      department: currentTab === 'faculty' ? ACADEMIC_DEPARTMENTS[0] : OPERATIONAL_DEPARTMENTS[0],
      designation: currentTab === 'faculty' ? 'Assistant Professor' : 'Maintenance Supervisor',
      branch: currentTab === 'faculty' ? 'CSE' : '',
      officeLocation: '',
      phone: '',
      customFields: {},
    });
    setCustomFieldErrors({});
    setModalError(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (rec: UserRecord) => {
    setSelectedUser(rec);
    setFormData({
      name: rec.name || '',
      email: rec.email || '',
      employeeId: rec.employeeId || '',
      department: rec.department || (currentTab === 'faculty' ? ACADEMIC_DEPARTMENTS[0] : OPERATIONAL_DEPARTMENTS[0]),
      designation: rec.designation || '',
      branch: rec.branch || '',
      officeLocation: rec.officeLocation || '',
      phone: rec.phone || '',
      customFields: rec.customFields || {},
    });
    setCustomFieldErrors({});
    setModalError(null);
    setIsEditModalOpen(true);
  };

  // Open View Modal
  const handleOpenView = (rec: UserRecord) => {
    setSelectedUser(rec);
    setIsViewModalOpen(true);
  };

  // Open Deactivate Confirmation Modal
  const handleOpenDeactivate = (rec: UserRecord) => {
    setSelectedUser(rec);
    setIsDeactivateModalOpen(true);
  };

  // Open Reactivate Confirmation Modal
  const handleOpenReactivate = (rec: UserRecord) => {
    setSelectedUser(rec);
    setIsReactivateModalOpen(true);
  };

  // Submit Add Record
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

      const targetRole: UserRole = currentTab === 'faculty' ? 'FACULTY' : 'STAFF';

      const res = await userService.createUser(
        {
          role: targetRole,
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          employeeId: formData.employeeId.trim().toUpperCase(),
          department: formData.department.trim(),
          designation: formData.designation.trim(),
          branch: currentTab === 'faculty' ? formData.branch.trim() : undefined,
          officeLocation: formData.officeLocation.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          customFields: formData.customFields || {},
        },
        actor
      );

      if (!res.success) {
        setModalError(res.error || 'Failed to create account.');
        setIsSubmitting(false);
        return;
      }

      setIsAddModalOpen(false);
      setToastMessage(`${currentTab === 'faculty' ? 'Faculty' : 'Staff'} record created for ${formData.name}.`);
      setTimeout(() => setToastMessage(null), 5000);
      loadRecords();
      fetchStats();
    } catch (err: any) {
      setModalError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Record
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setModalError(null);
    setCustomFieldErrors({});

    // Dynamic configuration-driven validation
    const validation = formConfigService.validateFormValues(
      formConfig,
      formData,
      formData.customFields || {},
      selectedUser
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
        selectedUser.uid,
        {
          name: formData.name.trim(),
          employeeId: formData.employeeId.trim().toUpperCase(),
          department: formData.department.trim(),
          designation: formData.designation.trim(),
          branch: currentTab === 'faculty' ? formData.branch.trim() : undefined,
          officeLocation: formData.officeLocation.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          customFields: formData.customFields || {},
        },
        actor
      );

      if (!res.success) {
        setModalError(res.error || 'Failed to update record.');
        setIsSubmitting(false);
        return;
      }

      setIsEditModalOpen(false);
      setToastMessage(`Profile updated for ${formData.name}.`);
      setTimeout(() => setToastMessage(null), 5000);
      loadRecords();
      fetchStats();
    } catch (err: any) {
      setModalError(err.message || 'Failed to update profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Deactivation
  const handleConfirmDeactivate = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const actor = {
        uid: userProfile?.uid || 'admin',
        name: userProfile?.name || 'Administrator',
        role: role || 'MAIN_ADMIN',
      };

      const res = await userService.deactivateUser(
        selectedUser.uid,
        actor,
        `Administrative Deactivation of ${selectedUser.role}`
      );
      if (res.success) {
        setIsDeactivateModalOpen(false);
        setToastMessage(`Account for ${selectedUser.name} has been deactivated.`);
        setTimeout(() => setToastMessage(null), 5000);
        loadRecords();
        fetchStats();
      } else {
        alert(res.error || 'Failed to deactivate account.');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred during deactivation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Reactivation
  const handleConfirmReactivate = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const actor = {
        uid: userProfile?.uid || 'admin',
        name: userProfile?.name || 'Administrator',
        role: role || 'MAIN_ADMIN',
      };

      const res = await userService.reactivateUser(selectedUser.uid, actor);
      if (res.success) {
        setIsReactivateModalOpen(false);
        setToastMessage(`Account access restored for ${selectedUser.name}.`);
        setTimeout(() => setToastMessage(null), 5000);
        loadRecords();
        fetchStats();
      } else {
        alert(res.error || 'Failed to reactivate account.');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred during reactivation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const departmentsList = currentTab === 'faculty' ? ACADEMIC_DEPARTMENTS : OPERATIONAL_DEPARTMENTS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%' }}>
      {toastMessage && (
        <Alert variant="success" title="Success" dismissible onDismiss={() => setToastMessage(null)}>
          {toastMessage}
        </Alert>
      )}

      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>
            {currentTab === 'faculty' ? 'Faculty Management' : 'Staff Management'}
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            {currentTab === 'faculty'
              ? 'Institutional roster for academic professors, lecturers, and departmental researchers.'
              : 'Institutional directory for campus operations, maintenance, hostel supervisors, and estate staff.'}
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
            {currentTab === 'faculty' ? 'Add Faculty' : 'Add Staff'}
          </Button>
        </div>
      </div>

      {/* Role Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid var(--color-border)',
          paddingBottom: '0.25rem',
        }}
      >
        <button
          type="button"
          onClick={() => handleTabChange('faculty')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: currentTab === 'faculty' ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: currentTab === 'faculty' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            fontWeight: currentTab === 'faculty' ? 700 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <GraduationCap size={18} />
          Faculty Directory ({stats.facultyTotal})
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('staff')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: currentTab === 'staff' ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: currentTab === 'staff' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            fontWeight: currentTab === 'staff' ? 700 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Wrench size={18} />
          Staff Directory ({stats.staffTotal})
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid-cards-4">
        <StatCard
          label={currentTab === 'faculty' ? 'Total Faculty' : 'Total Operational Staff'}
          value={currentTab === 'faculty' ? stats.facultyTotal : stats.staffTotal}
          subtitle={`Across ${departmentsList.length} departments`}
          icon={<UserCheck size={22} />}
        />
        <StatCard
          label="Active Accounts"
          value={currentTab === 'faculty' ? stats.facultyActive : stats.staffActive}
          subtitle="Authorized personnel"
          icon={<CheckCircle size={22} />}
        />
        <StatCard
          label="Deactivated"
          value={
            currentTab === 'faculty'
              ? stats.facultyTotal - stats.facultyActive
              : stats.staffTotal - stats.staffActive
          }
          subtitle="Access suspended"
          icon={<UserX size={22} />}
        />
        <StatCard
          label="Departments"
          value={departmentsList.length}
          subtitle={currentTab === 'faculty' ? 'Academic faculties' : 'Operational services'}
          icon={<Building size={22} />}
        />
      </div>

      {/* Filters */}
      <Card>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 280px', position: 'relative' }}>
            <label htmlFor={searchInputId} style={{ display: 'none' }}>
              Search {currentTab}
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
              placeholder={`Search ${currentTab} by name, email, ID, designation...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem', width: '100%' }}
            />
          </div>

          <div style={{ flex: '1 1 220px' }}>
            <select
              aria-label={`Filter ${currentTab} by department`}
              className="input-field"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="ALL">All Departments</option>
              {departmentsList.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div style={{ width: '150px' }}>
            <select
              aria-label={`Filter ${currentTab} by status`}
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
            onClick={() => {
              loadRecords();
              fetchStats();
            }}
          >
            Refresh
          </Button>
        </div>
      </Card>

      {/* Data List */}
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
        ) : usersList.length === 0 ? (
          <EmptyState
            title={`No ${currentTab === 'faculty' ? 'Faculty' : 'Staff'} Members Found`}
            description={`No personnel match your search query. Click "Add ${currentTab === 'faculty' ? 'Faculty' : 'Staff'}" to register personnel.`}
            icon={<UserCheck size={40} />}
          />
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="table-responsive hide-on-mobile">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name & Email</th>
                    <th>{currentTab === 'faculty' ? 'Faculty ID' : 'Staff ID'}</th>
                    <th>Designation & Department</th>
                    <th>{currentTab === 'faculty' ? 'Branch' : 'Office Location'}</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((person) => (
                    <tr key={person.uid}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{person.name}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{person.email}</span>
                          {person.phone && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{person.phone}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                          {person.employeeId || '—'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{person.designation || 'N/A'}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{person.department || 'N/A'}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem' }}>
                          {currentTab === 'faculty' ? person.branch || 'General' : person.officeLocation || 'Campus'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {person.isActive ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="danger">Inactive</Badge>
                          )}
                          {!person.isActivated && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-warning)' }}>
                              Setup Pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`View details for ${person.name}`}
                            onClick={() => handleOpenView(person)}
                          >
                            <Eye size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${person.name}`}
                            onClick={() => handleOpenEdit(person)}
                          >
                            <Edit2 size={15} />
                          </Button>
                          {person.isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Deactivate ${person.name}`}
                              style={{ color: 'var(--color-danger)' }}
                              onClick={() => handleOpenDeactivate(person)}
                            >
                              <UserX size={15} />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Reactivate ${person.name}`}
                              style={{ color: 'var(--color-success)' }}
                              onClick={() => handleOpenReactivate(person)}
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
            <div className="show-on-mobile" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {usersList.map((person) => (
                <div
                  key={person.uid}
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
                      <h4 style={{ margin: 0, fontSize: '1rem' }}>{person.name}</h4>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{person.email}</div>
                    </div>
                    {person.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="danger">Inactive</Badge>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>ID</span>
                      <strong style={{ fontFamily: 'monospace' }}>{person.employeeId || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Designation</span>
                      <span>{person.designation || 'Staff'}</span>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Department</span>
                      <span>{person.department || '—'}</span>
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
                    <Button variant="outline" size="sm" leftIcon={<Eye size={14} />} onClick={() => handleOpenView(person)}>
                      View
                    </Button>
                    <Button variant="outline" size="sm" leftIcon={<Edit2 size={14} />} onClick={() => handleOpenEdit(person)}>
                      Edit
                    </Button>
                    {person.isActive ? (
                      <Button
                        variant="outline"
                        size="sm"
                        style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                        leftIcon={<UserX size={14} />}
                        onClick={() => handleOpenDeactivate(person)}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                        leftIcon={<UserCheck size={14} />}
                        onClick={() => handleOpenReactivate(person)}
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
      {/* ADD MODAL                                                                 */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={currentTab === 'faculty' ? 'Add Faculty Member' : 'Add Staff Member'}
        size="normal"
      >
        <form onSubmit={handleSubmitAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {modalError && (
            <Alert variant="danger" title="Validation Error">
              {modalError}
            </Alert>
          )}

          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <strong>First-Time Activation Flow:</strong> The {currentTab === 'faculty' ? 'Faculty' : 'Staff'} record will be initialized with status <Badge variant="success">isActive = true</Badge> and <Badge variant="neutral">isActivated = false</Badge>. No password is given by administrator; user sets password on first login.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label className="input-label" htmlFor="fac-name">Full Name *</label>
              <input
                id="fac-name"
                type="text"
                required
                className="input-field"
                placeholder={currentTab === 'faculty' ? 'e.g. Dr. Sanjeev Mohanty' : 'e.g. Mr. Binod Rout'}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="input-label" htmlFor="fac-email">Email Address *</label>
              <input
                id="fac-email"
                type="email"
                required
                className="input-field"
                placeholder="e.g. name@campuslife.edu"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            {isFieldEnabled('employeeId') && (
              <div>
                <label className="input-label" htmlFor="fac-empid">
                  {currentTab === 'faculty' ? 'Faculty / Employee ID' : 'Staff ID'}{isFieldRequired('employeeId') ? ' *' : ''}
                </label>
                <input
                  id="fac-empid"
                  type="text"
                  required={isFieldRequired('employeeId')}
                  className="input-field"
                  placeholder={currentTab === 'faculty' ? 'e.g. FAC202601' : 'e.g. STF202601'}
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                />
              </div>
            )}

            {isFieldEnabled('department') && (
              <div>
                <label className="input-label" htmlFor="fac-dept">
                  Department{isFieldRequired('department') ? ' *' : ''}
                </label>
                <select
                  id="fac-dept"
                  className="input-field"
                  required={isFieldRequired('department')}
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                >
                  {departmentsList.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            {isFieldEnabled('designation') && (
              <div>
                <label className="input-label" htmlFor="fac-desig">
                  Designation{isFieldRequired('designation') ? ' *' : ''}
                </label>
                <input
                  id="fac-desig"
                  type="text"
                  required={isFieldRequired('designation')}
                  className="input-field"
                  placeholder={currentTab === 'faculty' ? 'e.g. Professor & HOD' : 'e.g. Chief Maintenance Supervisor'}
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                />
              </div>
            )}

            {currentTab === 'faculty' && isFieldEnabled('branch') && (
              <div>
                <label className="input-label" htmlFor="fac-branch">
                  Branch / Specialization{isFieldRequired('branch') ? ' *' : ''}
                </label>
                <input
                  id="fac-branch"
                  type="text"
                  required={isFieldRequired('branch')}
                  className="input-field"
                  placeholder="e.g. CSE, AI & Data Science"
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                />
              </div>
            )}

            {currentTab === 'staff' && isFieldEnabled('officeLocation') && (
              <div>
                <label className="input-label" htmlFor="fac-office">
                  Office / Service Location{isFieldRequired('officeLocation') ? ' *' : ''}
                </label>
                <input
                  id="fac-office"
                  type="text"
                  required={isFieldRequired('officeLocation')}
                  className="input-field"
                  placeholder="e.g. Workshop Block - Room 102"
                  value={formData.officeLocation}
                  onChange={(e) => setFormData({ ...formData, officeLocation: e.target.value })}
                />
              </div>
            )}

            {isFieldEnabled('phone') && (
              <div>
                <label className="input-label" htmlFor="fac-phone">
                  Contact Phone{isFieldRequired('phone') ? ' *' : ''}
                </label>
                <input
                  id="fac-phone"
                  type="tel"
                  required={isFieldRequired('phone')}
                  className="input-field"
                  placeholder="+91 98765 00000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
              Create {currentTab === 'faculty' ? 'Faculty' : 'Staff'} Record
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* EDIT MODAL                                                                */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit ${currentTab === 'faculty' ? 'Faculty' : 'Staff'} — ${selectedUser?.name}`}
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
              <label className="input-label" htmlFor="edit-fac-name">Full Name *</label>
              <input
                id="edit-fac-name"
                type="text"
                required
                className="input-field"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="input-label" htmlFor="edit-fac-email">Email (Immutable)</label>
              <input
                id="edit-fac-email"
                type="email"
                disabled
                className="input-field"
                value={formData.email}
                style={{ opacity: 0.7, cursor: 'not-allowed' }}
              />
            </div>

            {isFieldEnabled('employeeId') && (
              <div>
                <label className="input-label" htmlFor="edit-fac-empid">
                  Employee / Staff ID{isFieldRequired('employeeId') ? ' *' : ''}
                </label>
                <input
                  id="edit-fac-empid"
                  type="text"
                  required={isFieldRequired('employeeId')}
                  className="input-field"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                />
              </div>
            )}

            {isFieldEnabled('department') && (
              <div>
                <label className="input-label" htmlFor="edit-fac-dept">
                  Department{isFieldRequired('department') ? ' *' : ''}
                </label>
                <select
                  id="edit-fac-dept"
                  className="input-field"
                  required={isFieldRequired('department')}
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                >
                  {departmentsList.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            {isFieldEnabled('designation') && (
              <div>
                <label className="input-label" htmlFor="edit-fac-desig">
                  Designation{isFieldRequired('designation') ? ' *' : ''}
                </label>
                <input
                  id="edit-fac-desig"
                  type="text"
                  required={isFieldRequired('designation')}
                  className="input-field"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                />
              </div>
            )}

            {currentTab === 'faculty' && isFieldEnabled('branch') && (
              <div>
                <label className="input-label" htmlFor="edit-fac-branch">
                  Branch / Specialization{isFieldRequired('branch') ? ' *' : ''}
                </label>
                <input
                  id="edit-fac-branch"
                  type="text"
                  required={isFieldRequired('branch')}
                  className="input-field"
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                />
              </div>
            )}

            {currentTab === 'staff' && isFieldEnabled('officeLocation') && (
              <div>
                <label className="input-label" htmlFor="edit-fac-office">
                  Office Location{isFieldRequired('officeLocation') ? ' *' : ''}
                </label>
                <input
                  id="edit-fac-office"
                  type="text"
                  required={isFieldRequired('officeLocation')}
                  className="input-field"
                  value={formData.officeLocation}
                  onChange={(e) => setFormData({ ...formData, officeLocation: e.target.value })}
                />
              </div>
            )}

            {isFieldEnabled('phone') && (
              <div>
                <label className="input-label" htmlFor="edit-fac-phone">
                  Contact Phone{isFieldRequired('phone') ? ' *' : ''}
                </label>
                <input
                  id="edit-fac-phone"
                  type="tel"
                  required={isFieldRequired('phone')}
                  className="input-field"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
            targetUser={selectedUser}
            onOpenAddField={() => setIsAddCustomFieldModalOpen(true)}
            onOpenConfigureFields={() => setIsFieldConfigModalOpen(true)}
            canManage={role === 'MAIN_ADMIN'}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <Button variant="ghost" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* VIEW DETAILS MODAL                                                        */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`${currentTab === 'faculty' ? 'Faculty' : 'Staff'} Personnel Dossier`}
        size="normal"
      >
        {selectedUser && (
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
                {selectedUser.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem' }}>{selectedUser.name}</h3>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <Badge variant={selectedUser.isActive ? 'success' : 'danger'}>
                    {selectedUser.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="info">{selectedUser.role}</Badge>
                  {!selectedUser.isActivated && (
                    <Badge variant="warning">First-Time Setup Pending</Badge>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Email</span>
                <strong>{selectedUser.email}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Employee ID</span>
                <strong style={{ fontFamily: 'monospace' }}>{selectedUser.employeeId || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Department</span>
                <strong>{selectedUser.department || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Designation</span>
                <strong>{selectedUser.designation || '—'}</strong>
              </div>
              {selectedUser.branch && (
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Branch / Discipline</span>
                  <strong>{selectedUser.branch}</strong>
                </div>
              )}
              {selectedUser.officeLocation && (
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Office / Station</span>
                  <strong>{selectedUser.officeLocation}</strong>
                </div>
              )}
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Phone</span>
                <strong>{selectedUser.phone || 'N/A'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Registered On</span>
                <span>{new Date(selectedUser.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {selectedUser.customFields && Object.keys(selectedUser.customFields).length > 0 && (
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>Additional / Custom Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                  {Object.entries(selectedUser.customFields).map(([key, val]) => {
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
        title={`Deactivate ${currentTab === 'faculty' ? 'Faculty' : 'Staff'}?`}
        size="normal"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-main)' }}>
            The {currentTab === 'faculty' ? 'faculty' : 'staff'} member will no longer be able to access Campus Life.
          </p>

          <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
            <div><strong>Name:</strong> {selectedUser?.name}</div>
            <div><strong>Email:</strong> {selectedUser?.email}</div>
            <div><strong>Designation:</strong> {selectedUser?.designation}</div>
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
        title={`Reactivate ${currentTab === 'faculty' ? 'Faculty' : 'Staff'}?`}
        size="normal"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-main)' }}>
            This will restore Campus Life access for this account.
          </p>

          <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
            <div><strong>Name:</strong> {selectedUser?.name}</div>
            <div><strong>Email:</strong> {selectedUser?.email}</div>
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
        formType="FACULTY"
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
        formType="FACULTY"
        availableUsers={usersList}
        onSave={async (fieldDef) => {
          const res = await formConfigService.addCustomField('FACULTY', fieldDef, {
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
