import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Clock,
  MapPin,
  X,
  BookOpen,
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../context/useAuth';
import { calendarService } from '../../services/calendarService';
import type { CampusCalendarEvent, CalendarEventCategory } from '../../types';

export const CalendarPage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const [events, setEvents] = useState<CampusCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'event' as CalendarEventCategory,
    startDate: new Date().toISOString().substring(0, 16),
    endDate: '',
    location: '',
    organizer: '',
  });

  const canManageCalendar =
    role === 'MAIN_ADMIN' ||
    userProfile?.permissions?.includes('MANAGE_CALENDAR');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await calendarService.getEvents();
      setEvents(data);
    } catch (err) {
      console.warn('Failed to load calendar events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = calendarService.subscribeEvents((data) => {
      setEvents(data);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setIsSubmitting(true);
    try {
      await calendarService.createEvent(
        {
          title: formData.title,
          description: formData.description,
          category: formData.category,
          startDate: new Date(formData.startDate).toISOString(),
          endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
          location: formData.location || 'Campus',
          organizer: formData.organizer || userProfile.name,
        },
        userProfile
      );

      setCreateModalOpen(false);
      setFormData({
        title: '',
        description: '',
        category: 'event',
        startDate: new Date().toISOString().substring(0, 16),
        endDate: '',
        location: '',
        organizer: '',
      });
      await loadEvents();
    } catch (err) {
      console.error('Failed to create event:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryBadgeVariant = (cat: string) => {
    switch (cat) {
      case 'examination':
        return 'danger';
      case 'holiday':
        return 'info';
      case 'workshop':
        return 'warning';
      case 'deadline':
        return 'danger';
      case 'event':
      default:
        return 'success';
    }
  };

  const filteredEvents = events.filter((e) => {
    if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Campus Academic Calendar</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Official university schedules, examination dates, institutional holidays, and symposiums.
          </p>
        </div>
        {canManageCalendar && (
          <Button
            variant="primary"
            leftIcon={<Plus size={16} />}
            onClick={() => setCreateModalOpen(true)}
          >
            Add Calendar Event
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div
        className="card"
        style={{
          padding: '0.85rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { key: 'ALL', label: 'All Dates' },
            { key: 'examination', label: 'Examinations' },
            { key: 'holiday', label: 'Holidays' },
            { key: 'event', label: 'Campus Events' },
            { key: 'workshop', label: 'Workshops' },
            { key: 'deadline', label: 'Deadlines' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className="btn-ghost"
              onClick={() => setCategoryFilter(tab.key)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.825rem',
                fontWeight: categoryFilter === tab.key ? 600 : 500,
                backgroundColor: categoryFilter === tab.key ? 'var(--brand-primary)' : 'var(--bg-subtle)',
                color: categoryFilter === tab.key ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {filteredEvents.length} events scheduled
        </span>
      </div>

      {/* Events Timeline / Cards */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Upcoming University Schedule</h3>
        </div>

        <div className="card-body">
          {loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading campus schedule...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No campus events found under the selected category.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredEvents.map((e) => {
                const sDate = new Date(e.startDate);
                return (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '1rem',
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-default)',
                      backgroundColor: 'var(--bg-surface)',
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Date Block */}
                    <div
                      style={{
                        width: 58,
                        height: 58,
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--brand-primary)' }}>
                        {sDate.toLocaleString('default', { month: 'short' })}
                      </span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1 }}>
                        {sDate.getDate()}
                      </span>
                    </div>

                    {/* Details */}
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                        <Badge variant={getCategoryBadgeVariant(e.category)}>
                          {e.category.toUpperCase()}
                        </Badge>
                        <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
                          {e.title}
                        </h4>
                      </div>

                      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {e.description}
                      </p>

                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {e.location && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <MapPin size={14} /> {e.location}
                          </div>
                        )}
                        {e.organizer && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <BookOpen size={14} /> {e.organizer}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Clock size={14} /> {sDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {e.endDate && ` – ${new Date(e.endDate).toLocaleDateString()}`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CREATE EVENT MODAL */}
      {createModalOpen && (
        <div className="modal-backdrop" onClick={() => setCreateModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '580px', width: '92%' }}
          >
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Add University Calendar Event</h3>
              <button
                type="button"
                className="btn-ghost btn-icon"
                onClick={() => setCreateModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateEvent}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="form-label">Event Title *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Mid-Semester Examinations or Diwali Break"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Category *</label>
                    <select
                      className="form-input"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as CalendarEventCategory })}
                    >
                      <option value="examination">Examination</option>
                      <option value="holiday">Holiday</option>
                      <option value="event">Campus Event</option>
                      <option value="workshop">Workshop</option>
                      <option value="deadline">Academic Deadline</option>
                      <option value="academic">Academic</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Campus Venue / Location</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Central Exam Block, Hall 3"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Start Date & Time *</label>
                    <input
                      type="datetime-local"
                      required
                      className="form-input"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label">End Date & Time (Optional)</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Organizing Department / Office</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Controller of Examinations or Dept of CSE"
                    value={formData.organizer}
                    onChange={(e) => setFormData({ ...formData, organizer: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Event Description *</label>
                  <textarea
                    required
                    rows={3}
                    className="form-input"
                    placeholder="Provide full schedule details, reporting timings, and instructions..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <Button variant="ghost" type="button" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" isLoading={isSubmitting}>
                  Save Event
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
