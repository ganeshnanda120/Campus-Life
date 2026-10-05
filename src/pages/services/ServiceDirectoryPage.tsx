import React, { useState, useEffect, useCallback } from 'react';
import {
  Phone,
  Mail,
  Clock,
  MapPin,
  Search,
  Plus,
  Info,
  X,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/useAuth';
import { directoryService } from '../../services/directoryService';
import type { ServiceDirectoryEntry } from '../../types';

export const ServiceDirectoryPage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const [services, setServices] = useState<ServiceDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Admin Add Service Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    department: 'Administration',
    responsibleOffice: '',
    servicesProvided: '',
    workingHours: '09:30 AM – 05:00 PM',
    location: '',
    contactEmail: '',
    contactPhone: '',
    instructions: '',
  });

  const canManageDirectory =
    role === 'MAIN_ADMIN' ||
    userProfile?.permissions?.includes('MANAGE_SERVICE_DIRECTORY');

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await directoryService.getServices({
        department: departmentFilter !== 'ALL' ? departmentFilter : undefined,
        search: searchQuery || undefined,
      });
      setServices(data);
    } catch (err) {
      console.warn('Failed to load service directory:', err);
    } finally {
      setLoading(false);
    }
  }, [departmentFilter, searchQuery]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setIsSubmitting(true);
    try {
      await directoryService.addService(
        {
          department: formData.department,
          responsibleOffice: formData.responsibleOffice,
          servicesProvided: formData.servicesProvided
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
          workingHours: formData.workingHours,
          location: formData.location,
          contactEmail: formData.contactEmail,
          contactPhone: formData.contactPhone,
          instructions: formData.instructions,
        },
        userProfile
      );

      setModalOpen(false);
      setFormData({
        department: 'Administration',
        responsibleOffice: '',
        servicesProvided: '',
        workingHours: '09:30 AM – 05:00 PM',
        location: '',
        contactEmail: '',
        contactPhone: '',
        instructions: '',
      });
      await loadServices();
    } catch (err) {
      console.error('Failed to add directory entry:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const departments = [
    'ALL',
    'Examination',
    'Hostel',
    'IT',
    'Medical',
    'Accounts',
    'Library',
    'Maintenance',
    'Student Affairs',
    'Administration',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Campus Service Directory</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Official office locations, working hours, services handled, and verified contact helplines.
          </p>
        </div>
        {canManageDirectory && (
          <Button
            variant="primary"
            leftIcon={<Plus size={16} />}
            onClick={() => setModalOpen(true)}
          >
            Add Campus Office
          </Button>
        )}
      </div>

      {/* Toolbar & Filters */}
      <div
        className="card"
        style={{
          padding: '1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: '240px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search office or service handled..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.25rem', height: '38px', fontSize: '0.9rem' }}
            />
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
          </div>

          <select
            className="form-input"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            style={{ height: '38px', width: 'auto', paddingRight: '2rem' }}
          >
            {departments.map((d) => (
              <option key={d} value={d}>
                {d === 'ALL' ? 'All Departments' : d}
              </option>
            ))}
          </select>
        </div>

        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {services.length} official offices listed
        </span>
      </div>

      {/* Directory Grid */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading campus service directory...
        </div>
      ) : services.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            No offices found matching your criteria.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {services.map((s) => (
            <div key={s.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.05rem', margin: 0 }}>{s.responsibleOffice}</h3>
                <Badge variant="neutral">{s.department}</Badge>
              </div>

              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                  <MapPin size={16} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
                  <span>{s.location}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                  <Clock size={16} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />
                  <span>{s.workingHours}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                  <Mail size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>{s.contactEmail}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                  <Phone size={16} style={{ color: 'var(--status-success)', flexShrink: 0 }} />
                  <span>{s.contactPhone}</span>
                </div>

                {s.instructions && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.4rem',
                      padding: '0.6rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-subtle)',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      marginTop: '0.25rem',
                    }}
                  >
                    <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{s.instructions}</span>
                  </div>
                )}

                <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Services Handled:
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {s.servicesProvided.map((srv) => (
                      <span
                        key={srv}
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-subtle)',
                          fontSize: '0.75rem',
                        }}
                      >
                        {srv}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD OFFICE MODAL */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', width: '92%' }}
          >
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Add Campus Office to Directory</h3>
              <button
                type="button"
                className="btn-ghost btn-icon"
                onClick={() => setModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Department *</label>
                    <select
                      className="form-input"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    >
                      <option value="Administration">Administration</option>
                      <option value="Examination">Examination</option>
                      <option value="Hostel">Hostel</option>
                      <option value="IT">IT</option>
                      <option value="Medical">Medical</option>
                      <option value="Accounts">Accounts</option>
                      <option value="Library">Library</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Student Affairs">Student Affairs</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Office Name *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="e.g. Office of the Controller of Examinations"
                      value={formData.responsibleOffice}
                      onChange={(e) => setFormData({ ...formData, responsibleOffice: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Location / Room Number *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="e.g. Admin Block, 1st Floor, Room 104"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Working Hours *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="e.g. 09:30 AM – 05:00 PM"
                      value={formData.workingHours}
                      onChange={(e) => setFormData({ ...formData, workingHours: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Official Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="e.g. coe@bputcampuslife.edu"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Helpline / Phone Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. +91 674 2300101"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Services Provided (comma-separated) *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Grade Sheets, Transcripts, Migration, Course Registration"
                    value={formData.servicesProvided}
                    onChange={(e) => setFormData({ ...formData, servicesProvided: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Special Instructions for Students</label>
                  <textarea
                    rows={3}
                    className="form-input"
                    placeholder="e.g. Bring student digital ID and hall ticket for in-person document collection."
                    value={formData.instructions}
                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                    style={{ minHeight: '90px' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" isLoading={isSubmitting}>
                  Add Office
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
