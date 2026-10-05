import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building,
  Users,
  AlertTriangle,
  Clock,
  Phone,
  Plus,
  RefreshCw,
  Bell,
  Bed,
} from 'lucide-react';
import { StatCard, Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { Skeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../context/useAuth';
import { hostelService } from '../../services/hostelService';
import { complaintService } from '../../services/complaintService';
import type {
  HostelRoom,
  HostelAllocation,
  HostelNotice,
} from '../../types';

export const HostelPage: React.FC = () => {
  const { userProfile, role, permissions } = useAuth();
  const navigate = useNavigate();

  const isDayScholar = userProfile?.studentCategory === 'DAY_SCHOLAR';
  const isAdminOrStaff =
    role === 'MAIN_ADMIN' ||
    (role === 'SUB_ADMIN' && permissions.includes('MANAGE_HOSTEL')) ||
    role === 'STAFF';

  const [allocation, setAllocation] = useState<HostelAllocation | null>(null);
  const [roomDetails, setRoomDetails] = useState<HostelRoom | null>(null);
  const [notices, setNotices] = useState<HostelNotice[]>([]);
  const [allRooms, setAllRooms] = useState<HostelRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Quick Hostel Maintenance Modal
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [maintTitle, setMaintTitle] = useState('');
  const [maintDesc, setMaintDesc] = useState('');
  const [maintLocation, setMaintLocation] = useState('');
  const [isSubmittingMaint, setIsSubmittingMaint] = useState(false);

  // Admin New Notice Modal
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeHostel, setNoticeHostel] = useState('Aryabhatta Hall of Residence');
  const [noticePriority, setNoticePriority] = useState<'NORMAL' | 'IMPORTANT' | 'URGENT'>('NORMAL');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadHostelData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!isDayScholar && userProfile?.uid) {
        const { allocation: alloc, roomDetails: room } =
          await hostelService.getAllocationForStudent(userProfile.uid);
        setAllocation(alloc);
        setRoomDetails(room);

        if (alloc) {
          setMaintLocation(`${alloc.hostelName}, ${alloc.block}, Room ${alloc.roomNumber}`);
        }
      }

      const noticeList = await hostelService.getHostelNotices();
      setNotices(noticeList);

      if (isAdminOrStaff) {
        const rooms = await hostelService.getAllRooms();
        setAllRooms(rooms);
      }
    } catch (err) {
      console.warn('Failed to load hostel data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isDayScholar, userProfile?.uid, isAdminOrStaff]);

  useEffect(() => {
    loadHostelData();
  }, [loadHostelData]);

  // Submit Hostel Maintenance
  const handleHostelMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintTitle.trim() || !maintDesc.trim()) {
      alert('Please enter a title and description.');
      return;
    }

    setIsSubmittingMaint(true);
    try {
      const loc = maintLocation || (allocation ? `${allocation.hostelName} Room ${allocation.roomNumber}` : 'Hostel Block');
      const cmp = await complaintService.createComplaint({
        studentId: userProfile?.uid || 'student_uid_001',
        studentName: userProfile?.name || 'Resident Student',
        studentEmail: userProfile?.email || 'student@bput.ac.in',
        category: 'Hostel',
        title: maintTitle.trim(),
        location: loc,
        description: maintDesc.trim(),
      });

      setIsMaintenanceModalOpen(false);
      setMaintTitle('');
      setMaintDesc('');
      setToastMessage(`Maintenance ticket #${cmp.complaintId} created successfully. Tracked in Complaints.`);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit maintenance request.');
    } finally {
      setIsSubmittingMaint(false);
    }
  };

  // Submit Hostel Notice
  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeContent.trim()) return;

    try {
      await hostelService.addHostelNotice(
        {
          title: noticeTitle.trim(),
          content: noticeContent.trim(),
          hostelName: noticeHostel,
          priority: noticePriority,
        },
        {
          uid: userProfile?.uid || 'admin_001',
          name: userProfile?.name || 'Hostel Administrator',
          role: role || 'SUB_ADMIN',
        }
      );

      setIsNoticeModalOpen(false);
      setNoticeTitle('');
      setNoticeContent('');
      setToastMessage('Hostel notice published successfully.');
      setTimeout(() => setToastMessage(null), 5000);
      loadHostelData();
    } catch (err: any) {
      alert(err.message || 'Failed to post notice.');
    }
  };

  // If student is DAY_SCHOLAR, show clear restriction message
  if (role === 'STUDENT' && isDayScholar) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '840px', margin: '0 auto', width: '100%' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Hostel Operations</h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Residential housing, room allocations, and hostel facilities.
          </p>
        </div>

        <Card>
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <Building size={48} style={{ color: 'var(--color-text-muted)', margin: '0 auto 1rem auto' }} />
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Day Scholar Account</h3>
            <p style={{ maxWidth: '520px', margin: '0 auto 1.5rem auto', color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              You are currently registered as a <strong>Day Scholar</strong>. Hostel room allocations, curfew monitoring, and hall operations are active exclusively for enrolled campus residents.
            </p>
            <Button
              variant="primary"
              onClick={() => navigate('/student/requests')}
            >
              Apply for Hostel Accommodation
            </Button>
          </div>
        </Card>
      </div>
    );
  }

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
          <h1 style={{ marginBottom: '0.25rem' }}>Hostel Residential Operations</h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Room allocation registry, warden administration, maintenance requests, and hall notices.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw size={14} className={isLoading ? 'spin' : ''} />}
            onClick={loadHostelData}
          >
            Refresh
          </Button>

          {!isDayScholar && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<AlertTriangle size={15} />}
              onClick={() => setIsMaintenanceModalOpen(true)}
            >
              Hostel Maintenance Request
            </Button>
          )}

          {isAdminOrStaff && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Plus size={15} />}
              onClick={() => setIsNoticeModalOpen(true)}
            >
              Publish Notice
            </Button>
          )}
        </div>
      </div>

      {/* Operational Overview Cards */}
      <div className="grid-cards-3">
        <StatCard
          label="Assigned Accommodation"
          value={allocation ? `${allocation.block} • Room ${allocation.roomNumber}` : 'Unassigned'}
          subtitle={allocation?.hostelName || 'Awaiting Allocation'}
          icon={<Building size={22} style={{ color: 'var(--brand-primary)' }} />}
        />
        <StatCard
          label="Room Capacity & Occupancy"
          value={roomDetails ? `${roomDetails.occupied} / ${roomDetails.capacity} Beds` : '3 / 3 Beds'}
          subtitle="Full occupancy verified"
          icon={<Users size={22} style={{ color: 'var(--color-success, #16a34a)' }} />}
        />
        <StatCard
          label="Residential Gate Curfew"
          value={roomDetails?.curfewTime || '09:00 PM'}
          subtitle="Biometric roll-call active"
          icon={<Clock size={22} style={{ color: 'var(--color-warning, #d97706)' }} />}
        />
      </div>

      {/* Room Details & Roommates */}
      {isLoading ? (
        <Card>
          <Skeleton height="120px" />
        </Card>
      ) : allocation ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {/* Room Allocation Info */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Room Allocation Details</h3>
              <Badge variant="success">Active Allocation</Badge>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Hostel Hall</span>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{allocation.hostelName}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Block & Room</span>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{allocation.block} • Room #{allocation.roomNumber}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Bed / Corner</span>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Bed {allocation.bedNumber || 'A'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Allocation Date</span>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{allocation.allocationDate}</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <Phone size={14} style={{ color: 'var(--brand-primary)' }} />
                <span>Warden: <strong>{roomDetails?.wardenName || 'Prof. Rajesh Swain'}</strong> ({roomDetails?.wardenContact || '+91 98765 00001'})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <Phone size={14} style={{ color: 'var(--brand-primary)' }} />
                <span>Caretaker: <strong>{roomDetails?.caretakerName || 'Mr. J. K. Nayak'}</strong> ({roomDetails?.caretakerContact || '+91 98765 00012'})</span>
              </div>
            </div>
          </Card>

          {/* Roommates Registry */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Allocated Roommates</h3>
              <Badge variant="info">{allocation.roommates?.length || 0} Roommates</Badge>
            </div>

            {allocation.roommates && allocation.roommates.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {allocation.roommates.map((rm, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          backgroundColor: 'var(--brand-primary-light)',
                          color: 'var(--brand-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                        }}
                      >
                        {rm.name[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rm.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Roll: {rm.rollNumber} • {rm.branch}
                        </div>
                      </div>
                    </div>
                    <Badge variant="neutral">Verified Resident</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-muted)' }}>
                <Bed size={32} style={{ margin: '0 auto 0.5rem auto' }} />
                <p style={{ margin: 0, fontSize: '0.9rem' }}>No roommate records currently mapped.</p>
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card>
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-muted)' }}>
            No room allocation on file. Contact Hostel Administration.
          </div>
        </Card>
      )}

      {/* Hostel Notices */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Bell size={18} style={{ color: 'var(--brand-primary)' }} />
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Hostel & Residential Circulars</h3>
        </div>

        {notices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-muted)' }}>
            No active hostel notices at this time.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {notices.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-subtle)',
                  borderLeft: n.priority === 'IMPORTANT' || n.priority === 'URGENT' ? '4px solid var(--color-danger, #dc2626)' : '4px solid var(--brand-primary)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{n.title}</h4>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{n.date}</span>
                    <Badge variant={n.priority === 'IMPORTANT' ? 'danger' : 'info'}>{n.priority}</Badge>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {n.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Admin Room Management Section */}
      {isAdminOrStaff && allRooms.length > 0 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Hostel Room Directory & Occupancy</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Administrative room status view</span>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hostel Hall</th>
                  <th>Block & Room</th>
                  <th>Floor</th>
                  <th>Capacity</th>
                  <th>Occupied</th>
                  <th>Warden</th>
                </tr>
              </thead>
              <tbody>
                {allRooms.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.hostelName}</td>
                    <td>{r.block} • Room #{r.roomNumber}</td>
                    <td>Floor {r.floor}</td>
                    <td>{r.capacity} Beds</td>
                    <td>
                      <Badge variant={r.occupied >= r.capacity ? 'danger' : 'success'}>
                        {r.occupied} / {r.capacity} Occupied
                      </Badge>
                    </td>
                    <td>{r.wardenName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Quick Hostel Maintenance Modal */}
      <Modal
        isOpen={isMaintenanceModalOpen}
        onClose={() => !isSubmittingMaint && setIsMaintenanceModalOpen(false)}
        title="Hostel Maintenance Request"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', width: '100%' }}>
            <Button variant="outline" onClick={() => setIsMaintenanceModalOpen(false)} disabled={isSubmittingMaint}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleHostelMaintenance} disabled={isSubmittingMaint}>
              {isSubmittingMaint ? 'Submitting...' : 'Register Complaint'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleHostelMaintenance} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Alert variant="info">
            Hostel maintenance grievances are directly routed to the estate & electrical maintenance team through the centralized grievance SLA system.
          </Alert>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Location / Room
            </label>
            <input
              type="text"
              className="input-field"
              value={maintLocation}
              onChange={(e) => setMaintLocation(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Maintenance Subject *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g., Geyser not heating, Washbasin leakage, Fan regulator defect"
              value={maintTitle}
              onChange={(e) => setMaintTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Description *
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="Provide exact defect symptoms and available hours for maintenance technician access..."
              value={maintDesc}
              onChange={(e) => setMaintDesc(e.target.value)}
              required
            />
          </div>
        </form>
      </Modal>

      {/* Admin Post Notice Modal */}
      <Modal
        isOpen={isNoticeModalOpen}
        onClose={() => setIsNoticeModalOpen(false)}
        title="Publish Hostel Residential Notice"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', width: '100%' }}>
            <Button variant="outline" onClick={() => setIsNoticeModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateNotice}>Publish Notice</Button>
          </div>
        }
      >
        <form onSubmit={handleCreateNotice} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Hostel Hall
            </label>
            <select
              className="input-field"
              value={noticeHostel}
              onChange={(e) => setNoticeHostel(e.target.value)}
            >
              <option value="Aryabhatta Hall of Residence">Aryabhatta Hall of Residence</option>
              <option value="Kalam Hall of Residence">Kalam Hall of Residence</option>
              <option value="All Hostels">All Campus Hostels</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Notice Title *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Electrical maintenance, Curfew timings update"
              value={noticeTitle}
              onChange={(e) => setNoticeTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Priority Level
            </label>
            <select
              className="input-field"
              value={noticePriority}
              onChange={(e) => setNoticePriority(e.target.value as any)}
            >
              <option value="NORMAL">Normal</option>
              <option value="IMPORTANT">Important</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Notice Content *
            </label>
            <textarea
              className="input-field"
              rows={4}
              placeholder="Full text of the circular..."
              value={noticeContent}
              onChange={(e) => setNoticeContent(e.target.value)}
              required
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
