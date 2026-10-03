import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  RefreshCw,
  Edit2,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { Skeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../context/useAuth';
import {
  timetableService,
  DAYS_OF_WEEK,
} from '../../services/timetableService';
import type { TimetableEntry } from '../../types';

export const TimetablePage: React.FC = () => {
  const { userProfile, role, permissions } = useAuth();

  const isAuthorizedToManage =
    role === 'FACULTY' ||
    role === 'MAIN_ADMIN' ||
    (role === 'SUB_ADMIN' && permissions.includes('MANAGE_TIMETABLE'));

  // Data States
  const [todayClasses, setTodayClasses] = useState<TimetableEntry[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<Record<string, TimetableEntry[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Mobile selected day state
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDayName = dayNames[new Date().getDay()];
  const defaultSelectedDay = DAYS_OF_WEEK.includes(todayDayName as any) ? todayDayName : 'Monday';
  const [activeDay, setActiveDay] = useState<string>(defaultSelectedDay);

  // Status Update Modal States
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimetableEntry | null>(null);
  const [newStatus, setNewStatus] = useState<'SCHEDULED' | 'CANCELLED' | 'RESCHEDULED'>('CANCELLED');
  const [statusNote, setStatusNote] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadTimetable = useCallback(async () => {
    setIsLoading(true);
    try {
      const [today, weekly] = await Promise.all([
        timetableService.getTodayClasses(),
        timetableService.getWeeklyTimetable(),
      ]);
      setTodayClasses(today);
      setWeeklySchedule(weekly);
    } catch (err) {
      console.warn('Failed to load timetable:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = timetableService.subscribeTimetable((weekly) => {
      setWeeklySchedule(weekly);
      const currentDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
      setTodayClasses(weekly[currentDay] || []);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Open Update Modal
  const handleOpenUpdate = (entry: TimetableEntry) => {
    setSelectedEntry(entry);
    setNewStatus(entry.status === 'CANCELLED' ? 'SCHEDULED' : 'CANCELLED');
    setStatusNote(entry.note || '');
    setIsUpdateModalOpen(true);
  };

  // Submit Class Update
  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry) return;

    setIsUpdating(true);
    try {
      const actor = {
        uid: userProfile?.uid || 'user_001',
        name: userProfile?.name || 'Administrator',
        role: role || 'FACULTY',
      };

      const res = await timetableService.updateClassStatus(
        selectedEntry.id,
        newStatus,
        statusNote.trim() || undefined,
        actor
      );

      if (!res.success) {
        alert(res.error || 'Failed to update class status.');
        setIsUpdating(false);
        return;
      }

      setIsUpdateModalOpen(false);
      setToastMessage(`Class status updated for ${selectedEntry.subjectCode} to ${newStatus}.`);
      setTimeout(() => setToastMessage(null), 5000);
      loadTimetable();
    } catch (err: any) {
      alert(err.message || 'Error occurred while updating class.');
    } finally {
      setIsUpdating(false);
    }
  };

  const renderStatusBadge = (status: TimetableEntry['status']) => {
    switch (status) {
      case 'ONGOING':
        return <Badge variant="warning">Ongoing Now</Badge>;
      case 'COMPLETED':
        return <Badge variant="neutral">Completed</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
      case 'RESCHEDULED':
        return <Badge variant="warning">Rescheduled</Badge>;
      case 'SCHEDULED':
      default:
        return <Badge variant="info">Scheduled</Badge>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%' }}>
      {/* Toast Feedback */}
      {toastMessage && (
        <Alert variant="success" title="Success" dismissible onDismiss={() => setToastMessage(null)}>
          {toastMessage}
        </Alert>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Class Timetable</h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Real-time daily schedule, lecture venues, and verified classroom notices for Semester 6.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          leftIcon={<RefreshCw size={14} className={isLoading ? 'spin' : ''} />}
          onClick={loadTimetable}
        >
          Refresh Schedule
        </Button>
      </div>

      {/* Today's Schedule Card (Section 11 & 12) */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
              Today's Lectures ({todayDayName === 'Sunday' ? 'Previewing Monday' : todayDayName})
            </h3>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {todayClasses.length} lectures scheduled
          </span>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Skeleton height="55px" />
            <Skeleton height="55px" />
          </div>
        ) : todayClasses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>
            No lectures scheduled for today.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {todayClasses.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: item.status === 'ONGOING' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  backgroundColor: item.status === 'ONGOING' ? 'rgba(37, 99, 235, 0.05)' : 'var(--color-bg-secondary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>
                      {item.subjectCode}: {item.subjectName}
                    </span>
                    {renderStatusBadge(item.status)}
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.35rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <span>Instructor: <strong>{item.facultyName}</strong></span>
                    <span>Room / Lab: <strong>{item.room}</strong></span>
                  </div>

                  {item.note && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-warning)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <AlertTriangle size={14} />
                      <span>{item.note}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.95rem' }}>
                      {item.timeSlot}
                    </div>
                  </div>

                  {isAuthorizedToManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Edit2 size={13} />}
                      onClick={() => handleOpenUpdate(item)}
                    >
                      Update
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Weekly Schedule Section (Section 11 & Section 34: Mobile Day Switcher) */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Weekly Academic Schedule</h3>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Monday through Saturday</span>
        </div>

        {/* Day Selector Pills for Mobile & Tablet (Section 34) */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            paddingBottom: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          {DAYS_OF_WEEK.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setActiveDay(d)}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-border)',
                backgroundColor: activeDay === d ? 'var(--color-primary)' : 'var(--color-bg-surface)',
                color: activeDay === d ? '#ffffff' : 'var(--color-text-main)',
                fontWeight: activeDay === d ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {d} {d === todayDayName && '• Today'}
            </button>
          ))}
        </div>

        {/* Day Class Stack (Clean, Mobile-Friendly, Zero Horizontal Overflow) */}
        <div>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>
            Schedule for {activeDay}
          </h4>

          {(weeklySchedule[activeDay] || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              No classes scheduled for {activeDay}.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(weeklySchedule[activeDay] || []).map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      {entry.subjectCode}: {entry.subjectName}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                      {entry.facultyName} • Venue: <strong>{entry.room}</strong>
                    </div>
                    {entry.note && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-warning)', marginTop: '0.25rem' }}>
                        Note: {entry.note}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, fontFamily: 'monospace' }}>
                      {entry.timeSlot}
                    </span>
                    {renderStatusBadge(entry.status)}

                    {isAuthorizedToManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Update ${entry.subjectCode}`}
                        onClick={() => handleOpenUpdate(entry)}
                      >
                        <Edit2 size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* CLASS STATUS UPDATE MODAL (Section 12)                                    */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        title={`Update Class: ${selectedEntry?.subjectCode}`}
        size="normal"
      >
        <form onSubmit={handleSubmitUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
            <div><strong>Subject:</strong> {selectedEntry?.subjectName}</div>
            <div><strong>Schedule:</strong> {selectedEntry?.day} • {selectedEntry?.timeSlot}</div>
            <div><strong>Venue:</strong> {selectedEntry?.room}</div>
          </div>

          <div>
            <label className="input-label" htmlFor="cls-status">Operational Status *</label>
            <select
              id="cls-status"
              className="input-field"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as any)}
            >
              <option value="SCHEDULED">SCHEDULED (Normal Lecture)</option>
              <option value="CANCELLED">CANCELLED (Suspended Class)</option>
              <option value="RESCHEDULED">RESCHEDULED (Time / Room Shifted)</option>
            </select>
          </div>

          <div>
            <label className="input-label" htmlFor="cls-note">Notice / Reason Note</label>
            <textarea
              id="cls-note"
              className="input-field"
              rows={2}
              placeholder="e.g. Class cancelled due to departmental faculty symposium. Makeup session next Saturday."
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <Button variant="ghost" type="button" onClick={() => setIsUpdateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isUpdating}>
              Save Class Update
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
