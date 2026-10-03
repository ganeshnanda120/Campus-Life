import React, { useState, useEffect, useCallback, useId } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  UserX,
  UserCheck,
  Eye,
  RefreshCw,
  Home,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { StatCard, Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { Skeleton } from '../../components/common/Skeleton';
import { Alert } from '../../components/common/Alert';
import { useAuth } from '../../context/useAuth';
import { userService } from '../../services/userService';
import type { UserRecord, StudentCategory } from '../../types';

const DEPARTMENTS = [
  'Computer Science & Engineering',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Electronics & Telecommunication',
  'Information Technology',
];

const BRANCHES = ['CSE', 'EE', 'ME', 'CE', 'ETC', 'IT'];

export const StudentManagementPage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const searchInputId = useId();

  // Data & Query States
  const [students, setStudents] = useState<UserRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Counters
  const [stats, setStats] = useState({
    totalStudents: 0,
    hostelers: 0,
    dayScholars: 0,
    inactive: 0,
  });

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'studentId' | 'rollNumber' | 'department' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<UserRecord | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const initialFormData = {
    name: '',
    email: '',
    studentId: '',
    rollNumber: '',
    department: DEPARTMENTS[0],
    branch: BRANCHES[0],
    year: 1,
    semester: 1,
    studentCategory: 'HOSTELER' as StudentCategory,
    phone: '',
    gender: 'Male',
    dob: '',
    address: '',
    guardianName: '',
    guardianPhone: '',
    hostelName: 'BPUT Central Hostel',
    hostelBlock: 'Block A',
    roomNumber: '',
  };

  const [formData, setFormData] = useState(initialFormData);

  // Fetch KPI statistics
  const fetchStats = useCallback(async () => {
    try {
      const all = await userService.getAllUsers();
      const studentUsers = all.filter((u) => u.role === 'STUDENT');
      const hostelers = studentUsers.filter((u) => u.studentCategory === 'HOSTELER').length;
      const dayScholars = studentUsers.filter((u) => u.studentCategory === 'DAY_SCHOLAR').length;
      const inactive = studentUsers.filter((u) => !u.isActive).length;

      setStats({
        totalStudents: studentUsers.length,
        hostelers,
        dayScholars,
        inactive,
      });
    } catch (err) {
      console.warn('Failed to load student statistics:', err);
    }
  }, []);

  // Fetch paginated student records
  const loadStudents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await userService.queryUsers({
        role: 'STUDENT',
        searchQuery,
        department: departmentFilter === 'ALL' ? undefined : departmentFilter,
        branch: branchFilter === 'ALL' ? undefined : branchFilter,
        year: yearFilter === 'ALL' ? undefined : Number(yearFilter),
        studentCategory: categoryFilter === 'ALL' ? undefined : (categoryFilter as StudentCategory),
        status: statusFilter,
        sortBy,
        sortOrder,
        page: currentPage,
        pageSize,
      });

      setStudents(res.users);
      setTotalCount(res.totalCount);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.message || 'Failed to load student registry records.');
    } finally {
      setIsLoading(false);
    }
  }, [
    searchQuery,
    departmentFilter,
    branchFilter,
    yearFilter,
    categoryFilter,
    statusFilter,
    sortBy,
    sortOrder,
    currentPage,
    pageSize,
  ]);

  useEffect(() => {
    loadStudents();
    fetchStats();
  }, [loadStudents, fetchStats]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setDepartmentFilter('ALL');
    setBranchFilter('ALL');
    setYearFilter('ALL');
    setCategoryFilter('ALL');
    setStatusFilter('all');
    setSortBy('createdAt');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  // Open Add Student Modal
  const handleOpenAddModal = () => {
    setFormData(initialFormData);
    setModalError(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (student: UserRecord) => {
    setSelectedStudent(student);
    setFormData({
      name: student.name || '',
      email: student.email || '',
      studentId: student.studentId || '',
      rollNumber: student.rollNumber || '',
      department: student.department || DEPARTMENTS[0],
      branch: student.branch || BRANCHES[0],
      year: student.year || 1,
      semester: student.semester || 1,
      studentCategory: student.studentCategory || 'HOSTELER',
      phone: student.phone || '',
      gender: student.gender || 'Male',
      dob: student.dob || '',
      address: student.address || '',
      guardianName: student.guardianName || '',
      guardianPhone: student.guardianPhone || '',
      hostelName: student.hostelName || '',
      hostelBlock: student.hostelBlock || '',
      roomNumber: student.roomNumber || '',
    });
    setModalError(null);
    setIsEditModalOpen(true);
  };

  // Open View Modal
  const handleOpenViewModal = (student: UserRecord) => {
    setSelectedStudent(student);
    setIsViewModalOpen(true);
  };

  // Open Deactivate Confirmation Modal
  const handleOpenDeactivateModal = (student: UserRecord) => {
    setSelectedStudent(student);
    setIsDeactivateModalOpen(true);
  };

  // Open Reactivate Confirmation Modal
  const handleOpenReactivateModal = (student: UserRecord) => {
    setSelectedStudent(student);
    setIsReactivateModalOpen(true);
  };

  // Submit Add Student Form
  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    // Validation
    if (!formData.name.trim()) {
      setModalError('Full Name is required.');
      return;
    }
    if (!formData.email.trim()) {
      setModalError('Email address is required.');
      return;
    }
    if (!formData.studentId.trim()) {
      setModalError('Student ID is required.');
      return;
    }
    if (!formData.rollNumber.trim()) {
      setModalError('University Roll Number is required.');
      return;
    }

    if (formData.studentCategory === 'HOSTELER' && !formData.roomNumber.trim()) {
      setModalError('Room Number is required for Hostel residents.');
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
          role: 'STUDENT',
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          studentId: formData.studentId.trim().toUpperCase(),
          rollNumber: formData.rollNumber.trim().toUpperCase(),
          department: formData.department,
          branch: formData.branch,
          year: Number(formData.year),
          semester: Number(formData.semester),
          studentCategory: formData.studentCategory,
          phone: formData.phone.trim() || undefined,
          gender: formData.gender,
          dob: formData.dob || undefined,
          address: formData.address.trim() || undefined,
          guardianName: formData.guardianName.trim() || undefined,
          guardianPhone: formData.guardianPhone.trim() || undefined,
          hostelName: formData.studentCategory === 'HOSTELER' ? formData.hostelName : undefined,
          hostelBlock: formData.studentCategory === 'HOSTELER' ? formData.hostelBlock : undefined,
          roomNumber: formData.studentCategory === 'HOSTELER' ? formData.roomNumber.trim() : undefined,
        },
        actor
      );

      if (!res.success) {
        setModalError(res.error || 'Failed to create student record.');
        setIsSubmitting(false);
        return;
      }

      setIsAddModalOpen(false);
      setToastMessage(`Student account created successfully for ${formData.name}.`);
      setTimeout(() => setToastMessage(null), 5000);
      loadStudents();
      fetchStats();
    } catch (err: any) {
      setModalError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Student Form
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setModalError(null);

    if (!formData.name.trim()) {
      setModalError('Full Name is required.');
      return;
    }
    if (!formData.studentId.trim()) {
      setModalError('Student ID is required.');
      return;
    }
    if (!formData.rollNumber.trim()) {
      setModalError('University Roll Number is required.');
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
        selectedStudent.uid,
        {
          name: formData.name.trim(),
          studentId: formData.studentId.trim().toUpperCase(),
          rollNumber: formData.rollNumber.trim().toUpperCase(),
          department: formData.department,
          branch: formData.branch,
          year: Number(formData.year),
          semester: Number(formData.semester),
          studentCategory: formData.studentCategory,
          phone: formData.phone.trim() || undefined,
          gender: formData.gender,
          dob: formData.dob || undefined,
          address: formData.address.trim() || undefined,
          guardianName: formData.guardianName.trim() || undefined,
          guardianPhone: formData.guardianPhone.trim() || undefined,
          hostelName: formData.studentCategory === 'HOSTELER' ? formData.hostelName : '',
          hostelBlock: formData.studentCategory === 'HOSTELER' ? formData.hostelBlock : '',
          roomNumber: formData.studentCategory === 'HOSTELER' ? formData.roomNumber.trim() : '',
        },
        actor
      );

      if (!res.success) {
        setModalError(res.error || 'Failed to update student.');
        setIsSubmitting(false);
        return;
      }

      setIsEditModalOpen(false);
      setToastMessage(`Student profile updated for ${formData.name}.`);
      setTimeout(() => setToastMessage(null), 5000);
      loadStudents();
      fetchStats();
    } catch (err: any) {
      setModalError(err.message || 'Failed to update student profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Deactivation
  const handleConfirmDeactivate = async () => {
    if (!selectedStudent) return;
    setIsSubmitting(true);
    try {
      const actor = {
        uid: userProfile?.uid || 'admin',
        name: userProfile?.name || 'Administrator',
        role: role || 'MAIN_ADMIN',
      };

      const res = await userService.deactivateUser(selectedStudent.uid, actor, 'Administrative Deactivation');
      if (res.success) {
        setIsDeactivateModalOpen(false);
        setToastMessage(`Account for ${selectedStudent.name} has been deactivated.`);
        setTimeout(() => setToastMessage(null), 5000);
        loadStudents();
        fetchStats();
      } else {
        alert(res.error || 'Failed to deactivate account.');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred during deactivation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Reactivation
  const handleConfirmReactivate = async () => {
    if (!selectedStudent) return;
    setIsSubmitting(true);
    try {
      const actor = {
        uid: userProfile?.uid || 'admin',
        name: userProfile?.name || 'Administrator',
        role: role || 'MAIN_ADMIN',
      };

      const res = await userService.reactivateUser(selectedStudent.uid, actor);
      if (res.success) {
        setIsReactivateModalOpen(false);
        setToastMessage(`Account access restored for ${selectedStudent.name}.`);
        setTimeout(() => setToastMessage(null), 5000);
        loadStudents();
        fetchStats();
      } else {
        alert(res.error || 'Failed to reactivate account.');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred during reactivation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <Alert variant="success" title="Success" dismissible onDismiss={() => setToastMessage(null)}>
          {toastMessage}
        </Alert>
      )}

      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Student Management</h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Centralized student registry, category allocation, status control, and academic records.
          </p>
        </div>
        <Button
          id="btn-add-student"
          variant="primary"
          leftIcon={<Plus size={16} />}
          onClick={handleOpenAddModal}
        >
          Add Student
        </Button>
      </div>

      {/* Live KPI Statistics Cards */}
      <div className="grid-cards">
        <StatCard
          label="Total Students"
          value={stats.totalStudents}
          subtitle={
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              <Badge variant="info">Hostelers: {stats.hostelers}</Badge>
              <Badge variant="neutral">Day Scholars: {stats.dayScholars}</Badge>
            </div>
          }
          icon={<Users size={22} />}
        />
        <StatCard
          label="Active Accounts"
          value={stats.totalStudents - stats.inactive}
          subtitle={
            <Badge variant="success">
              {stats.totalStudents > 0
                ? `${Math.round(((stats.totalStudents - stats.inactive) / stats.totalStudents) * 100)}% active`
                : '100% active'}
            </Badge>
          }
          icon={<GraduationCap size={22} />}
        />
        <StatCard
          label="Hostel Residents"
          value={stats.hostelers}
          subtitle="Allocated to campus blocks"
          icon={<Home size={22} />}
        />
        <StatCard
          label="Deactivated Accounts"
          value={stats.inactive}
          subtitle={stats.inactive > 0 ? 'Access suspended' : 'No suspended accounts'}
          icon={<UserX size={22} />}
        />
      </div>

      {/* Search, Filter & Sort Toolbar */}
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 280px', position: 'relative' }}>
              <label htmlFor={searchInputId} style={{ display: 'none' }}>
                Search students
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
                placeholder="Search by name, email, ID, roll no., department..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ paddingLeft: '2.5rem', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw size={14} className={isLoading ? 'spin' : ''} />}
                onClick={() => {
                  loadStudents();
                  fetchStats();
                }}
              >
                Refresh
              </Button>
              <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Granular Filter Dropdowns */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.75rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            {/* Department */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Department
              </label>
              <select
                aria-label="Filter by department"
                className="input-field"
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
              >
                <option value="ALL">All Departments</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Branch */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Branch
              </label>
              <select
                aria-label="Filter by branch"
                className="input-field"
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
              >
                <option value="ALL">All Branches</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Year */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Year
              </label>
              <select
                aria-label="Filter by academic year"
                className="input-field"
                value={yearFilter}
                onChange={(e) => {
                  setYearFilter(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
              >
                <option value="ALL">All Years</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Category
              </label>
              <select
                aria-label="Filter by student category"
                className="input-field"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
              >
                <option value="ALL">All Categories</option>
                <option value="HOSTELER">Hosteler</option>
                <option value="DAY_SCHOLAR">Day Scholar</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Account Status
              </label>
              <select
                aria-label="Filter by account status"
                className="input-field"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Sort By
              </label>
              <select
                aria-label="Sort student records"
                className="input-field"
                value={`${sortBy}_${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('_');
                  setSortBy(field as any);
                  setSortOrder(order as any);
                }}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
              >
                <option value="createdAt_desc">Newest First</option>
                <option value="createdAt_asc">Oldest First</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="studentId_asc">Student ID (Asc)</option>
                <option value="rollNumber_asc">Roll Number (Asc)</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Student Registry Table / Cards */}
      <Card>
        {error && (
          <Alert variant="danger" title="Registry Error">
            {error}
          </Alert>
        )}

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 0' }}>
            <Skeleton height="40px" />
            <Skeleton height="40px" />
            <Skeleton height="40px" />
            <Skeleton height="40px" />
          </div>
        ) : students.length === 0 ? (
          <EmptyState
            title="No students found"
            description="No student records match your search or filter criteria. Try adjusting your query parameters."
            icon={<Users size={40} />}
            action={
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Reset Search Filters
              </Button>
            }
          />
        ) : (
          <div>
            {/* Desktop Table View with Controlled Horizontal Overflow */}
            <div className="table-responsive hide-on-mobile">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student Info</th>
                    <th>ID / Roll No.</th>
                    <th>Academic Program</th>
                    <th>Category & Room</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((stu) => (
                    <tr key={stu.uid}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{stu.name}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{stu.email}</span>
                          {stu.phone && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{stu.phone}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{stu.studentId || '—'}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                            Roll: {stu.rollNumber || '—'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{stu.department || 'N/A'}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {stu.branch} • Year {stu.year || '—'} (Sem {stu.semester || '—'})
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {stu.studentCategory === 'HOSTELER' ? (
                            <Badge variant="info">Hosteler</Badge>
                          ) : (
                            <Badge variant="neutral">Day Scholar</Badge>
                          )}
                          {stu.studentCategory === 'HOSTELER' && stu.roomNumber && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              {stu.hostelBlock || ''} Rm {stu.roomNumber}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {stu.isActive ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="danger">Inactive</Badge>
                          )}
                          {!stu.isActivated && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-warning)' }}>
                              Unactivated
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`View details for ${stu.name}`}
                            onClick={() => handleOpenViewModal(stu)}
                          >
                            <Eye size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${stu.name}`}
                            onClick={() => handleOpenEditModal(stu)}
                          >
                            <Edit2 size={15} />
                          </Button>
                          {stu.isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Deactivate ${stu.name}`}
                              style={{ color: 'var(--color-danger)' }}
                              onClick={() => handleOpenDeactivateModal(stu)}
                            >
                              <UserX size={15} />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Reactivate ${stu.name}`}
                              style={{ color: 'var(--color-success)' }}
                              onClick={() => handleOpenReactivateModal(stu)}
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

            {/* Mobile Responsive Cards View */}
            <div className="show-on-mobile" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {students.map((stu) => (
                <div
                  key={stu.uid}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem' }}>{stu.name}</h4>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{stu.email}</div>
                    </div>
                    {stu.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="danger">Inactive</Badge>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Student ID</span>
                      <strong style={{ fontFamily: 'monospace' }}>{stu.studentId || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Roll No.</span>
                      <strong style={{ fontFamily: 'monospace' }}>{stu.rollNumber || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Department</span>
                      <span>{stu.branch} • Year {stu.year || '—'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Category</span>
                      <span>{stu.studentCategory === 'HOSTELER' ? `Hostel: ${stu.roomNumber || 'Assigned'}` : 'Day Scholar'}</span>
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
                    <Button variant="outline" size="sm" leftIcon={<Eye size={14} />} onClick={() => handleOpenViewModal(stu)}>
                      View
                    </Button>
                    <Button variant="outline" size="sm" leftIcon={<Edit2 size={14} />} onClick={() => handleOpenEditModal(stu)}>
                      Edit
                    </Button>
                    {stu.isActive ? (
                      <Button
                        variant="outline"
                        size="sm"
                        style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                        leftIcon={<UserX size={14} />}
                        onClick={() => handleOpenDeactivateModal(stu)}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                        leftIcon={<UserCheck size={14} />}
                        onClick={() => handleOpenReactivateModal(stu)}
                      >
                        Reactivate
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Scalable Pagination Controls */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginTop: '1.25rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--color-border)',
              }}
            >
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Showing <strong>{students.length}</strong> of <strong>{totalCount}</strong> students
                (Page {currentPage} of {totalPages})
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<ChevronLeft size={14} />}
                  disabled={currentPage <= 1 || isLoading}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  rightIcon={<ChevronRight size={14} />}
                  disabled={currentPage >= totalPages || isLoading}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* ADD STUDENT MODAL                                                         */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Student"
        size="large"
      >
        <form onSubmit={handleSubmitAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {modalError && (
            <Alert variant="danger" title="Validation Error">
              {modalError}
            </Alert>
          )}

          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <strong>First-Time Activation Flow:</strong> The student account will be created with status{' '}
            <Badge variant="success">isActive = true</Badge> and{' '}
            <Badge variant="neutral">isActivated = false</Badge>. No password is assigned by administrators. The student completes email verification and sets their password on first login.
          </div>

          {/* Section: Basic Identity */}
          <div>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--color-primary)' }}>
              1. Basic Information
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="input-label" htmlFor="add-name">Full Name *</label>
                <input
                  id="add-name"
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. Aarav Sharma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label" htmlFor="add-email">Email Address *</label>
                <input
                  id="add-email"
                  type="email"
                  required
                  className="input-field"
                  placeholder="e.g. aarav.sharma@campuslife.edu"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label" htmlFor="add-student-id">Student ID *</label>
                <input
                  id="add-student-id"
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. STU2026042"
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label" htmlFor="add-roll-number">Roll Number *</label>
                <input
                  id="add-roll-number"
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. 220101042"
                  value={formData.rollNumber}
                  onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label" htmlFor="add-phone">Phone Number</label>
                <input
                  id="add-phone"
                  type="tel"
                  className="input-field"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label" htmlFor="add-gender">Gender</label>
                <select
                  id="add-gender"
                  className="input-field"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Academic Details */}
          <div>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--color-primary)' }}>
              2. Academic Program
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="input-label" htmlFor="add-dept">Department *</label>
                <select
                  id="add-dept"
                  className="input-field"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label" htmlFor="add-branch">Branch *</label>
                <select
                  id="add-branch"
                  className="input-field"
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                >
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label" htmlFor="add-year">Year (1-4) *</label>
                <select
                  id="add-year"
                  className="input-field"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                >
                  <option value={1}>1st Year</option>
                  <option value={2}>2nd Year</option>
                  <option value={3}>3rd Year</option>
                  <option value={4}>4th Year</option>
                </select>
              </div>

              <div>
                <label className="input-label" htmlFor="add-semester">Semester (1-8) *</label>
                <select
                  id="add-semester"
                  className="input-field"
                  value={formData.semester}
                  onChange={(e) => setFormData({ ...formData, semester: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section: Category & Residence */}
          <div>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--color-primary)' }}>
              3. Category & Residence
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="input-label" htmlFor="add-cat">Student Category *</label>
                <select
                  id="add-cat"
                  className="input-field"
                  value={formData.studentCategory}
                  onChange={(e) => setFormData({ ...formData, studentCategory: e.target.value as StudentCategory })}
                >
                  <option value="HOSTELER">Hosteler (Campus Resident)</option>
                  <option value="DAY_SCHOLAR">Day Scholar (Commuter)</option>
                </select>
              </div>

              {formData.studentCategory === 'HOSTELER' && (
                <>
                  <div>
                    <label className="input-label" htmlFor="add-hostel-name">Hostel Name *</label>
                    <input
                      id="add-hostel-name"
                      type="text"
                      className="input-field"
                      placeholder="e.g. BPUT Central Hostel"
                      value={formData.hostelName}
                      onChange={(e) => setFormData({ ...formData, hostelName: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="input-label" htmlFor="add-hostel-block">Block *</label>
                    <input
                      id="add-hostel-block"
                      type="text"
                      className="input-field"
                      placeholder="e.g. Block A"
                      value={formData.hostelBlock}
                      onChange={(e) => setFormData({ ...formData, hostelBlock: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="input-label" htmlFor="add-room-number">Room Number *</label>
                    <input
                      id="add-room-number"
                      type="text"
                      required
                      className="input-field"
                      placeholder="e.g. 204"
                      value={formData.roomNumber}
                      onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Section: Guardian & Address */}
          <div>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--color-primary)' }}>
              4. Guardian & Contact Info (Optional)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="input-label" htmlFor="add-guardian-name">Guardian Name</label>
                <input
                  id="add-guardian-name"
                  type="text"
                  className="input-field"
                  placeholder="Guardian / Parent Name"
                  value={formData.guardianName}
                  onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                />
              </div>
              <div>
                <label className="input-label" htmlFor="add-guardian-phone">Guardian Contact Phone</label>
                <input
                  id="add-guardian-phone"
                  type="tel"
                  className="input-field"
                  placeholder="+91 98765 00000"
                  value={formData.guardianPhone}
                  onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="input-label" htmlFor="add-address">Permanent Address</label>
                <textarea
                  id="add-address"
                  className="input-field"
                  rows={2}
                  placeholder="City, District, State, PIN..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <Button variant="ghost" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Create Student Record
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* EDIT STUDENT MODAL                                                        */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Student — ${selectedStudent?.name}`}
        size="large"
      >
        <form onSubmit={handleSubmitEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {modalError && (
            <Alert variant="danger" title="Validation Error">
              {modalError}
            </Alert>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label className="input-label" htmlFor="edit-name">Full Name *</label>
              <input
                id="edit-name"
                type="text"
                required
                className="input-field"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="input-label" htmlFor="edit-email">Email (Immutable)</label>
              <input
                id="edit-email"
                type="email"
                disabled
                className="input-field"
                value={formData.email}
                style={{ opacity: 0.7, cursor: 'not-allowed' }}
              />
            </div>

            <div>
              <label className="input-label" htmlFor="edit-student-id">Student ID *</label>
              <input
                id="edit-student-id"
                type="text"
                required
                className="input-field"
                value={formData.studentId}
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
              />
            </div>

            <div>
              <label className="input-label" htmlFor="edit-roll-number">Roll Number *</label>
              <input
                id="edit-roll-number"
                type="text"
                required
                className="input-field"
                value={formData.rollNumber}
                onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
              />
            </div>

            <div>
              <label className="input-label" htmlFor="edit-dept">Department *</label>
              <select
                id="edit-dept"
                className="input-field"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="input-label" htmlFor="edit-branch">Branch *</label>
              <select
                id="edit-branch"
                className="input-field"
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
              >
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="input-label" htmlFor="edit-year">Year *</label>
              <select
                id="edit-year"
                className="input-field"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
              >
                <option value={1}>1st Year</option>
                <option value={2}>2nd Year</option>
                <option value={3}>3rd Year</option>
                <option value={4}>4th Year</option>
              </select>
            </div>

            <div>
              <label className="input-label" htmlFor="edit-sem">Semester *</label>
              <select
                id="edit-sem"
                className="input-field"
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="input-label" htmlFor="edit-cat">Category *</label>
              <select
                id="edit-cat"
                className="input-field"
                value={formData.studentCategory}
                onChange={(e) => setFormData({ ...formData, studentCategory: e.target.value as StudentCategory })}
              >
                <option value="HOSTELER">Hosteler</option>
                <option value="DAY_SCHOLAR">Day Scholar</option>
              </select>
            </div>

            <div>
              <label className="input-label" htmlFor="edit-phone">Phone</label>
              <input
                id="edit-phone"
                type="tel"
                className="input-field"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          {formData.studentCategory === 'HOSTELER' && (
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>Hostel Room Details</h5>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                <div>
                  <label className="input-label" htmlFor="edit-hostel-name">Hostel</label>
                  <input
                    id="edit-hostel-name"
                    type="text"
                    className="input-field"
                    value={formData.hostelName}
                    onChange={(e) => setFormData({ ...formData, hostelName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="input-label" htmlFor="edit-hostel-block">Block</label>
                  <input
                    id="edit-hostel-block"
                    type="text"
                    className="input-field"
                    value={formData.hostelBlock}
                    onChange={(e) => setFormData({ ...formData, hostelBlock: e.target.value })}
                  />
                </div>
                <div>
                  <label className="input-label" htmlFor="edit-hostel-room">Room No.</label>
                  <input
                    id="edit-hostel-room"
                    type="text"
                    className="input-field"
                    value={formData.roomNumber}
                    onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

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
      {/* VIEW STUDENT DETAILS MODAL                                                */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Student Profile Details"
        size="normal"
      >
        {selectedStudent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header info badge */}
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
                {selectedStudent.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem' }}>{selectedStudent.name}</h3>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <Badge variant={selectedStudent.isActive ? 'success' : 'danger'}>
                    {selectedStudent.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant={selectedStudent.studentCategory === 'HOSTELER' ? 'info' : 'neutral'}>
                    {selectedStudent.studentCategory === 'HOSTELER' ? 'Hosteler' : 'Day Scholar'}
                  </Badge>
                  {!selectedStudent.isActivated && (
                    <Badge variant="warning">First-Time Setup Pending</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Dossier Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Email Address</span>
                <strong>{selectedStudent.email}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Student ID</span>
                <strong style={{ fontFamily: 'monospace' }}>{selectedStudent.studentId || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Roll Number</span>
                <strong style={{ fontFamily: 'monospace' }}>{selectedStudent.rollNumber || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Department</span>
                <strong>{selectedStudent.department || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Branch</span>
                <strong>{selectedStudent.branch || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Year & Semester</span>
                <strong>Year {selectedStudent.year || '—'} (Sem {selectedStudent.semester || '—'})</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Phone</span>
                <strong>{selectedStudent.phone || 'N/A'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Gender</span>
                <strong>{selectedStudent.gender || 'N/A'}</strong>
              </div>

              {selectedStudent.studentCategory === 'HOSTELER' && (
                <div style={{ gridColumn: '1 / -1', padding: '0.6rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Hostel Allocation</span>
                  <strong>{selectedStudent.hostelName || 'BPUT Hostel'} — {selectedStudent.hostelBlock || 'Block A'}, Room {selectedStudent.roomNumber || '—'}</strong>
                </div>
              )}

              {selectedStudent.guardianName && (
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Guardian</span>
                  <strong>{selectedStudent.guardianName} ({selectedStudent.guardianPhone || 'No phone'})</strong>
                </div>
              )}

              {selectedStudent.address && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Permanent Address</span>
                  <span>{selectedStudent.address}</span>
                </div>
              )}

              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Created On</span>
                <span>{new Date(selectedStudent.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
              <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* DEACTIVATE CONFIRMATION MODAL (Section 10)                                 */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDeactivateModalOpen}
        onClose={() => setIsDeactivateModalOpen(false)}
        title="Deactivate Student?"
        size="normal"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-main)' }}>
            The student will no longer be able to access Campus Life.
          </p>

          <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
            <div><strong>Student:</strong> {selectedStudent?.name}</div>
            <div><strong>Email:</strong> {selectedStudent?.email}</div>
            <div><strong>ID:</strong> {selectedStudent?.studentId}</div>
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
      {/* REACTIVATE CONFIRMATION MODAL (Section 10)                               */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isReactivateModalOpen}
        onClose={() => setIsReactivateModalOpen(false)}
        title="Reactivate Student?"
        size="normal"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-main)' }}>
            This will restore Campus Life access for this account.
          </p>

          <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
            <div><strong>Student:</strong> {selectedStudent?.name}</div>
            <div><strong>Email:</strong> {selectedStudent?.email}</div>
            <div><strong>ID:</strong> {selectedStudent?.studentId}</div>
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
    </div>
  );
};
