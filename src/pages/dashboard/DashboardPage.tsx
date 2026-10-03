import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  AlertTriangle,
  FileText,
  DoorOpen,
  CalendarCheck,
  Megaphone,
  Clock,
  ArrowRight,
  ShieldAlert,
  RefreshCw,
  IdCard,
  BookOpen,
  Building,
  Vote,
  Compass,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { StatCard, Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Skeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../context/useAuth';
import { userService, type DashboardStats } from '../../services/userService';
import { attendanceService, type StudentAttendanceSummary } from '../../services/attendanceService';
import { timetableService } from '../../services/timetableService';
import { requestService } from '../../services/requestService';
import { complaintService } from '../../services/complaintService';
import { noticeService } from '../../services/noticeService';
import { calendarService } from '../../services/calendarService';
import { pollService } from '../../services/pollService';
import { activityService } from '../../services/activityService';
import type {
  TimetableEntry,
  StudentRequest,
  Complaint,
  Notice,
  CampusCalendarEvent,
  CampusPoll,
  UserActivity,
} from '../../types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, role } = useAuth();

  // Admin stats
  const [adminStats, setAdminStats] = useState<DashboardStats>({
    totalStudents: 0,
    hostelers: 0,
    dayScholars: 0,
    totalFaculty: 0,
    totalStaff: 0,
    totalSubAdmins: 0,
    pendingRequests: 0,
    activeComplaints: 0,
    pendingGatePasses: 0,
  });

  // Student specific dashboard states
  const [attendance, setAttendance] = useState<StudentAttendanceSummary | null>(null);
  const [todayClasses, setTodayClasses] = useState<TimetableEntry[]>([]);
  const [pendingRequests, setPendingRequests] = useState<StudentRequest[]>([]);
  const [studentComplaints, setStudentComplaints] = useState<Complaint[]>([]);

  // Phase 6 Communication & Services States
  const [emergencyNotices, setEmergencyNotices] = useState<Notice[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CampusCalendarEvent[]>([]);
  const [activePolls, setActivePolls] = useState<CampusPoll[]>([]);
  const [recentActivities, setRecentActivities] = useState<UserActivity[]>([]);
  const [allNoticesCount, setAllNoticesCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Common communication states
      const [emgNotices, calEvents, pollsList, noticesList] = await Promise.all([
        noticeService.getEmergencyNotices(userProfile),
        calendarService.getEvents(),
        pollService.getPolls(),
        noticeService.getNotices(userProfile),
      ]);

      setEmergencyNotices(emgNotices);
      setUpcomingEvents(calEvents.slice(0, 3));
      setActivePolls(pollsList.filter((p) => p.status === 'ACTIVE').slice(0, 2));
      setAllNoticesCount(noticesList.length);

      if (userProfile?.uid) {
        const acts = await activityService.getUserActivities(userProfile.uid, 5);
        setRecentActivities(acts);
      }

      if (role === 'STUDENT') {
        const studentId = userProfile?.studentId || 'STU2026001';
        const uid = userProfile?.uid || 'student_uid_001';
        const [attData, classesData, reqsData, cmpData] = await Promise.all([
          attendanceService.getStudentAttendance(studentId),
          timetableService.getTodayClasses(),
          requestService.getStudentRequests(studentId),
          complaintService.getComplaints({ studentId: uid }),
        ]);
        setAttendance(attData);
        setTodayClasses(classesData);
        setPendingRequests(reqsData.filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED'));
        setStudentComplaints(cmpData.filter((c) => c.status !== 'RESOLVED' && c.status !== 'CLOSED'));
      } else {
        const data = await userService.getDashboardStats();
        setAdminStats(data);
      }
    } catch (err) {
      console.warn('Dashboard data fetch warning:', err);
    } finally {
      setIsLoading(false);
    }
  }, [role, userProfile]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle emergency notice acknowledgement from dashboard
  const handleAcknowledgeEmergency = async (noticeId: string) => {
    if (!userProfile) return;
    try {
      await noticeService.acknowledgeNotice(noticeId, userProfile);
      setEmergencyNotices((prev) =>
        prev.map((n) =>
          n.id === noticeId ? { ...n, acknowledgedCount: (n.acknowledgedCount || 0) + 1 } : n
        )
      );
    } catch (err) {
      console.error('Failed to acknowledge emergency notice:', err);
    }
  };

  // ===========================================================================
  // STUDENT DASHBOARD VIEW
  // ===========================================================================
  if (role === 'STUDENT') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%' }}>
        {/* Welcome Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.6rem' }}>
                Welcome back, {userProfile?.name || 'Student'}
              </h1>
              <Badge variant={userProfile?.studentCategory === 'HOSTELER' ? 'info' : 'neutral'}>
                {userProfile?.studentCategory === 'HOSTELER' ? 'Hosteler' : 'Day Scholar'}
              </Badge>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {userProfile?.studentId || 'STU2026001'} • Roll: {userProfile?.rollNumber || '220101001'} • {userProfile?.department || 'Computer Science & Engineering'} (Sem {userProfile?.semester || 6})
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw size={14} className={isLoading ? 'spin' : ''} />}
              onClick={fetchDashboardData}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<IdCard size={15} />}
              onClick={() => navigate('/id-card')}
            >
              Digital ID Card
            </Button>
          </div>
        </div>

        {/* SECTION 10: EMERGENCY NOTICE BANNER (Accessible text & icon) */}
        {emergencyNotices.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {emergencyNotices.map((emg) => {
              const hasAcked = userProfile
                ? noticeService.hasUserAcknowledged(emg.id, userProfile.uid)
                : false;

              return (
                <div
                  key={emg.id}
                  className="card"
                  style={{
                    borderLeft: '6px solid var(--status-danger)',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    padding: '1rem 1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flex: 1, minWidth: '240px' }}>
                      <AlertTriangle size={24} style={{ color: 'var(--status-danger)', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                          <Badge variant="danger" style={{ fontWeight: 700 }}>
                            [EMERGENCY NOTICE] {emg.priority}
                          </Badge>
                          <h4 style={{ margin: 0, fontSize: '1rem' }}>{emg.title}</h4>
                        </div>
                        <p style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {emg.description}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                      {emg.requiresAcknowledgement && (
                        <Button
                          variant={hasAcked ? 'secondary' : 'primary'}
                          size="sm"
                          leftIcon={<CheckCircle size={14} />}
                          onClick={() => handleAcknowledgeEmergency(emg.id)}
                          disabled={hasAcked}
                        >
                          {hasAcked ? 'Acknowledged' : 'I have read and understood'}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => navigate('/notices')}>
                        View Notices
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Top Operational KPI Cards */}
        <div className="grid-cards">
          {/* Attendance Card */}
          <StatCard
            label="Overall Attendance"
            value={attendance ? `${attendance.overallPercentage}%` : '84.2%'}
            subtitle={
              <Badge variant={attendance?.isEligible ? 'success' : 'danger'}>
                {attendance?.isEligible ? 'Eligible for Exams (>=75%)' : 'Shortage Alert (<75%)'}
              </Badge>
            }
            icon={<CalendarCheck size={22} />}
            onClick={() => navigate('/student/attendance')}
          />

          {/* Today's Classes Card */}
          <StatCard
            label="Today's Lectures"
            value={todayClasses.length}
            subtitle={
              todayClasses.some((c) => c.status === 'ONGOING')
                ? '1 Lecture currently ongoing'
                : 'All scheduled lectures'
            }
            icon={<BookOpen size={22} />}
            onClick={() => navigate('/student/timetable')}
          />

          {/* Pending Requests Card */}
          <StatCard
            label="Active Requests"
            value={pendingRequests.length}
            subtitle="Certificates & services queued"
            icon={<FileText size={22} />}
            onClick={() => navigate('/student/requests')}
          />

          {/* Open Complaints Summary */}
          <StatCard
            label="Open Complaints"
            value={studentComplaints.length}
            subtitle={
              studentComplaints.length > 0
                ? `${studentComplaints[0].category}: ${studentComplaints[0].title.slice(0, 24)}...`
                : 'No open grievances'
            }
            icon={<AlertTriangle size={22} />}
            onClick={() => navigate('/student/complaints')}
          />
        </div>

        {/* Main Content Grid: Today's Classes + Pending Requests */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.25rem',
            width: '100%',
          }}
        >
          {/* Today's Classes Schedule */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={18} style={{ color: 'var(--brand-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Today's Classes</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/student/timetable')}>
                Full Timetable <ArrowRight size={14} />
              </Button>
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Skeleton height="50px" />
                <Skeleton height="50px" />
              </div>
            ) : todayClasses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                No lectures scheduled for today. Enjoy your day!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {todayClasses.map((item) => {
                  let statusBadge = <Badge variant="info">Scheduled</Badge>;
                  if (item.status === 'ONGOING') statusBadge = <Badge variant="warning">Ongoing Now</Badge>;
                  if (item.status === 'COMPLETED') statusBadge = <Badge variant="neutral">Completed</Badge>;
                  if (item.status === 'CANCELLED') statusBadge = <Badge variant="danger">Cancelled</Badge>;
                  if (item.status === 'RESCHEDULED') statusBadge = <Badge variant="warning">Rescheduled</Badge>;

                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: '0.85rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-default)',
                        backgroundColor: item.status === 'ONGOING' ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-subtle)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                          {item.subjectCode}: {item.subjectName}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          {item.facultyName} • Room: <strong>{item.room}</strong>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 500, fontFamily: 'monospace' }}>
                          {item.timeSlot}
                        </span>
                        {statusBadge}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Pending Requests & Tracking */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} style={{ color: 'var(--brand-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Request Status</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/student/requests')}>
                Track All <ArrowRight size={14} />
              </Button>
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Skeleton height="50px" />
                <Skeleton height="50px" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                No active document or certificate requests in process.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-default)',
                      backgroundColor: 'var(--bg-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{req.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        #{req.requestId} • Dept: {req.assignedDepartment || req.department}
                      </div>
                    </div>
                    <Badge variant={req.status === 'APPROVED' ? 'success' : req.status === 'UNDER_REVIEW' ? 'warning' : 'info'}>
                      {req.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-default)' }}>
              <Button
                variant="outline"
                size="sm"
                style={{ width: '100%' }}
                onClick={() => navigate('/student/requests')}
              >
                + Submit New Certificate or Service Request
              </Button>
            </div>
          </Card>
        </div>

        {/* SECTION 18 & 22: UPCOMING EVENTS & ACTIVE POLLS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.25rem',
            width: '100%',
          }}
        >
          {/* Upcoming Academic Calendar Events */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} style={{ color: 'var(--brand-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Campus Calendar Events</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/calendar')}>
                View Calendar <ArrowRight size={14} />
              </Button>
            </div>

            {upcomingEvents.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No upcoming events scheduled this week.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {upcomingEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => navigate('/calendar')}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-default)',
                      backgroundColor: 'var(--bg-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ev.title}</div>
                      <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {new Date(ev.startDate).toLocaleDateString()} • {ev.location || 'Campus'}
                      </div>
                    </div>
                    <Badge variant={ev.category === 'examination' ? 'danger' : 'info'}>
                      {ev.category.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Active Digital Campus Poll */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Vote size={18} style={{ color: 'var(--brand-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Active Campus Survey</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/polls')}>
                All Polls <ArrowRight size={14} />
              </Button>
            </div>

            {activePolls.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No active campus surveys right now.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {activePolls.map((poll) => {
                  const hasVoted = userProfile ? poll.votedUserIds.includes(userProfile.uid) : false;
                  return (
                    <div
                      key={poll.id}
                      onClick={() => navigate('/polls')}
                      style={{
                        padding: '0.85rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-default)',
                        backgroundColor: 'var(--bg-subtle)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.925rem' }}>{poll.title}</div>
                        <Badge variant={hasVoted ? 'success' : 'info'}>
                          {hasVoted ? 'Voted' : 'Vote Now'}
                        </Badge>
                      </div>
                      <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {poll.description.substring(0, 90)}...
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* SECTION 15: MY ACTIVITY TIMELINE */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} style={{ color: 'var(--brand-primary)' }} />
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>My Activity Timeline</h3>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Latest actions & verified events</span>
          </div>

          {recentActivities.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No recent activity recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {recentActivities.map((act) => (
                <div
                  key={act.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-subtle)',
                    fontSize: '0.85rem',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {act.title || act.entityType.toUpperCase()}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{act.description}</div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Student Quick Action Grid */}
        <Card>
          <h3 style={{ fontSize: '1.05rem', margin: '0 0 1rem 0' }}>Quick Access</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '0.75rem',
            }}
          >
            <button
              type="button"
              className="card card-interactive"
              onClick={() => navigate('/student/gate-pass')}
              style={{ padding: '0.85rem', textAlign: 'left', border: '1px solid var(--border-default)', cursor: 'pointer', background: 'var(--bg-surface)' }}
            >
              <DoorOpen size={20} style={{ color: 'var(--brand-primary)', marginBottom: '0.4rem' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Apply Gate Pass</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Egress with verified QR</div>
            </button>

            <button
              type="button"
              className="card card-interactive"
              onClick={() => navigate('/notices')}
              style={{ padding: '0.85rem', textAlign: 'left', border: '1px solid var(--border-default)', cursor: 'pointer', background: 'var(--bg-surface)' }}
            >
              <Megaphone size={20} style={{ color: 'var(--status-danger)', marginBottom: '0.4rem' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Campus Notices</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Official circulars & alerts</div>
            </button>

            <button
              type="button"
              className="card card-interactive"
              onClick={() => navigate('/lost-found')}
              style={{ padding: '0.85rem', textAlign: 'left', border: '1px solid var(--border-default)', cursor: 'pointer', background: 'var(--bg-surface)' }}
            >
              <Compass size={20} style={{ color: 'var(--status-warning)', marginBottom: '0.4rem' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Lost & Found</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Retrieve or report items</div>
            </button>

            <button
              type="button"
              className="card card-interactive"
              onClick={() => navigate('/service-directory')}
              style={{ padding: '0.85rem', textAlign: 'left', border: '1px solid var(--border-default)', cursor: 'pointer', background: 'var(--bg-surface)' }}
            >
              <Building size={20} style={{ color: 'var(--status-info)', marginBottom: '0.4rem' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Service Directory</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Office hours & contacts</div>
            </button>

            <button
              type="button"
              className="card card-interactive"
              onClick={() => navigate('/help')}
              style={{ padding: '0.85rem', textAlign: 'left', border: '1px solid var(--border-default)', cursor: 'pointer', background: 'var(--bg-surface)' }}
            >
              <HelpCircle size={20} style={{ color: 'var(--status-success)', marginBottom: '0.4rem' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Help Center & FAQ</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Procedures and answers</div>
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // ===========================================================================
  // ADMIN & OPERATIONAL OVERVIEW DASHBOARD
  // ===========================================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%' }}>
      {/* Page Title & Quick Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Campus Operations Overview</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Real-time telemetry and management controls for campus life operations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw size={14} className={isLoading ? 'spin' : ''} />}
            onClick={fetchDashboardData}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            leftIcon={<Megaphone size={16} />}
            onClick={() => navigate('/notices')}
          >
            Publish Notice
          </Button>
        </div>
      </div>

      {/* EMERGENCY MODE ALERT IF ACTIVE */}
      {emergencyNotices.length > 0 && (
        <div
          className="card"
          style={{
            borderLeft: '6px solid var(--status-danger)',
            backgroundColor: 'var(--bg-surface-elevated)',
            padding: '1rem 1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <AlertTriangle size={24} style={{ color: 'var(--status-danger)' }} />
              <div>
                <h4 style={{ margin: 0, color: 'var(--status-danger)', fontSize: '1rem' }}>
                  ACTIVE EMERGENCY CIRCULAR BROADCASTING
                </h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {emergencyNotices[0].title} • Broadcasted campus-wide.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/notices')}>
              Manage Notices
            </Button>
          </div>
        </div>
      )}

      {/* Action Center Banner */}
      <div
        className="card"
        style={{
          borderLeft: '4px solid var(--status-warning)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(217, 119, 6, 0.1)',
                  color: 'var(--status-warning)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Clock size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Action Center: Needs Attention</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <strong>{adminStats.activeComplaints}</strong> active complaints • <strong>{adminStats.pendingGatePasses}</strong> pending gate passes • <strong>{allNoticesCount}</strong> active circulars
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/complaints')}
              >
                View Complaints
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/gate-pass')}
              >
                Review Passes
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid-cards">
        <StatCard
          label="Total Students"
          value={adminStats.totalStudents}
          subtitle={
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              <Badge variant="info">Hostelers: {adminStats.hostelers}</Badge>
              <Badge variant="neutral">Day Scholars: {adminStats.dayScholars}</Badge>
            </div>
          }
          icon={<Users size={22} />}
          onClick={() => navigate('/admin/students')}
        />

        <StatCard
          label="Total Sub-Admins"
          value={adminStats.totalSubAdmins}
          subtitle="Delegated module administrators"
          icon={<ShieldAlert size={22} />}
          onClick={() => navigate('/admin/sub-admins')}
        />

        <StatCard
          label="Active Campus Notices"
          value={allNoticesCount}
          subtitle="Broadcast & targeted notices"
          icon={<Megaphone size={22} />}
          onClick={() => navigate('/notices')}
        />

        <StatCard
          label="Complaints & SLA"
          value={adminStats.activeComplaints}
          subtitle="Active campus grievances"
          icon={<AlertTriangle size={22} />}
          onClick={() => navigate('/complaints')}
        />

        <StatCard
          label="Pending Requests"
          value={adminStats.pendingRequests}
          subtitle="Certificates & services queued"
          icon={<FileText size={22} />}
          onClick={() => navigate('/requests')}
        />

        <StatCard
          label="Gate Pass Requests"
          value={adminStats.pendingGatePasses}
          subtitle="Pending verification today"
          icon={<DoorOpen size={22} />}
          onClick={() => navigate('/gate-pass')}
        />
      </div>

      {/* SECTION 27: ADMIN COMMUNICATION & SERVICES WIDGETS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem',
          width: '100%',
        }}
      >
        {/* Calendar Management Overview */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} style={{ color: 'var(--brand-primary)' }} />
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Academic Calendar</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/calendar')}>
              Manage Calendar <ArrowRight size={14} />
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {upcomingEvents.map((ev) => (
              <div
                key={ev.id}
                style={{
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ev.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(ev.startDate).toLocaleDateString()} • {ev.location}
                  </div>
                </div>
                <Badge variant="info">{ev.category.toUpperCase()}</Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Digital Surveys Overview */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Vote size={18} style={{ color: 'var(--brand-primary)' }} />
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Campus Polls Telemetry</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/polls')}>
              Manage Polls <ArrowRight size={14} />
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activePolls.map((poll) => {
              const totalVotes = poll.options.reduce((acc, curr) => acc + curr.votes, 0);
              return (
                <div
                  key={poll.id}
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{poll.title}</div>
                    <Badge variant="success">{totalVotes} Votes</Badge>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Closes: {new Date(poll.expiryDate).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Quick Action Matrix */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Campus Services & Workflows</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Universal operations portal</span>
        </div>
        <div className="card-body">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1rem',
            }}
          >
            <button
              type="button"
              className="card card-interactive"
              onClick={() => navigate('/notices')}
              style={{ padding: '1rem', textAlign: 'left', border: '1px solid var(--border-default)', cursor: 'pointer', background: 'var(--bg-surface)' }}
            >
              <Megaphone size={22} style={{ color: 'var(--brand-primary)', marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Publish Notice</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Broadcast or targeted
              </div>
            </button>

            <button
              type="button"
              className="card card-interactive"
              onClick={() => navigate('/calendar')}
              style={{ padding: '1rem', textAlign: 'left', border: '1px solid var(--border-default)', cursor: 'pointer', background: 'var(--bg-surface)' }}
            >
              <Clock size={22} style={{ color: 'var(--status-info)', marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Campus Calendar</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Exams & symposiums
              </div>
            </button>

            <button
              type="button"
              className="card card-interactive"
              onClick={() => navigate('/lost-found')}
              style={{ padding: '1rem', textAlign: 'left', border: '1px solid var(--border-default)', cursor: 'pointer', background: 'var(--bg-surface)' }}
            >
              <Compass size={22} style={{ color: 'var(--status-warning)', marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Lost & Found</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Moderation & claims
              </div>
            </button>

            <button
              type="button"
              className="card card-interactive"
              onClick={() => navigate('/service-directory')}
              style={{ padding: '1rem', textAlign: 'left', border: '1px solid var(--border-default)', cursor: 'pointer', background: 'var(--bg-surface)' }}
            >
              <Building size={22} style={{ color: 'var(--status-success)', marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Service Directory</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Manage campus offices
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
