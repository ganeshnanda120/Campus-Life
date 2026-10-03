import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCheck,
  FileText,
  AlertTriangle,
  DoorOpen,
  Megaphone,
  Calendar,
  Award,
  CheckCircle,
  Vote,
  Compass,
  Building,
  Utensils,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../context/useAuth';
import { notificationService } from '../../services/notificationService';
import type { InAppNotification } from '../../types';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'ALL' | 'UNREAD'>('ALL');

  useEffect(() => {
    if (!userProfile?.uid) return;
    setLoading(true);
    const unsubscribe = notificationService.subscribeNotifications(userProfile.uid, (data) => {
      setNotifications(data);
      setLoading(false);
    });
    return () => {
      unsubscribe();
    };
  }, [userProfile?.uid]);

  const markAllAsRead = async () => {
    if (!userProfile?.uid) return;
    await notificationService.markAllAsRead(userProfile.uid);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const toggleRead = async (id: string, currentRead: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentRead) {
      await notificationService.markAsRead(id);
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: !n.isRead } : n))
    );
  };

  const handleNotificationClick = async (notif: InAppNotification) => {
    if (!notif.isRead) {
      await notificationService.markAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
    }
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'emergency':
        return <ShieldAlert size={18} style={{ color: 'var(--status-danger)' }} />;
      case 'gate_pass':
        return <DoorOpen size={18} style={{ color: 'var(--status-info)' }} />;
      case 'complaint':
        return <AlertTriangle size={18} style={{ color: 'var(--status-warning)' }} />;
      case 'request':
        return <FileText size={18} style={{ color: 'var(--brand-primary)' }} />;
      case 'attendance':
        return <CheckCircle size={18} style={{ color: 'var(--status-success)' }} />;
      case 'timetable':
        return <Calendar size={18} style={{ color: 'var(--brand-secondary, #6366f1)' }} />;
      case 'certificate':
        return <Award size={18} style={{ color: 'var(--status-success)' }} />;
      case 'poll':
        return <Vote size={18} style={{ color: 'var(--brand-primary)' }} />;
      case 'lost_found':
        return <Compass size={18} style={{ color: 'var(--status-warning)' }} />;
      case 'calendar':
        return <Calendar size={18} style={{ color: 'var(--brand-primary)' }} />;
      case 'hostel':
        return <Building size={18} style={{ color: 'var(--status-info)' }} />;
      case 'mess':
        return <Utensils size={18} style={{ color: 'var(--status-warning)' }} />;
      case 'notice':
      default:
        return <Megaphone size={18} style={{ color: 'var(--status-danger)' }} />;
    }
  };

  const filteredList = notifications.filter((n) => {
    if (filterMode === 'UNREAD') return !n.isRead;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '840px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Notification Center</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            In-website operational notifications, workflow updates, and circular alerts.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" leftIcon={<CheckCheck size={16} />} onClick={markAllAsRead}>
            Mark all as read
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setFilterMode('ALL')}
          style={{
            padding: '0.35rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            fontWeight: filterMode === 'ALL' ? 600 : 500,
            backgroundColor: filterMode === 'ALL' ? 'var(--brand-primary)' : 'var(--bg-subtle)',
            color: filterMode === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          All ({notifications.length})
        </button>

        <button
          type="button"
          className="btn-ghost"
          onClick={() => setFilterMode('UNREAD')}
          style={{
            padding: '0.35rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            fontWeight: filterMode === 'UNREAD' ? 600 : 500,
            backgroundColor: filterMode === 'UNREAD' ? 'var(--brand-primary)' : 'var(--bg-subtle)',
            color: filterMode === 'UNREAD' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          Unread Only ({unreadCount})
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading your campus notifications...
        </div>
      ) : filteredList.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            {filterMode === 'UNREAD' ? 'No unread notifications! You are all caught up.' : 'No notifications available.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredList.map((n) => (
            <div
              key={n.id}
              className="card card-interactive"
              onClick={() => handleNotificationClick(n)}
              style={{
                borderLeft: n.isRead ? '2px solid var(--border-default)' : '4px solid var(--brand-primary)',
                backgroundColor: n.isRead ? 'var(--bg-surface)' : 'var(--bg-surface-elevated)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--bg-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {getIcon(n.type)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{n.title}</h4>
                        {!n.isRead && (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: 'var(--brand-primary)',
                              display: 'inline-block',
                            }}
                          />
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p style={{ margin: '0.35rem 0 0.5rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {n.message}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', color: 'var(--text-muted)' }}
                        onClick={(e) => toggleRead(n.id, n.isRead, e)}
                      >
                        {n.isRead ? 'Mark unread' : 'Mark as read'}
                      </button>

                      {n.link && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--brand-primary)', fontWeight: 600 }}>
                          <span>Open details</span>
                          <ArrowRight size={13} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
