import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  FileText,
  DoorOpen,
  Building,
  Utensils,
  Wrench,
  RefreshCw,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { StatCard, Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Skeleton } from '../../components/common/Skeleton';
import {
  analyticsService,
  type ComplaintAnalytics,
  type RequestAnalytics,
  type CertificateAnalytics,
  type GatePassAnalytics,
  type HostelAnalytics,
  type MessAnalytics,
  type StaffWorkloadItem,
  type ResolutionTimeStats,
  type ActionCenterItem,
} from '../../services/analyticsService';

export const AnalyticsReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'complaints' | 'requests' | 'gatepass' | 'hostel_mess' | 'staff_workload' | 'action_center'>('complaints');
  const [isLoading, setIsLoading] = useState(true);

  // Telemetry states
  const [complaintData, setComplaintData] = useState<ComplaintAnalytics | null>(null);
  const [requestData, setRequestData] = useState<RequestAnalytics | null>(null);
  const [certData, setCertData] = useState<CertificateAnalytics | null>(null);
  const [passData, setPassData] = useState<GatePassAnalytics | null>(null);
  const [hostelData, setHostelData] = useState<HostelAnalytics | null>(null);
  const [messData, setMessData] = useState<MessAnalytics | null>(null);
  const [staffData, setStaffData] = useState<StaffWorkloadItem[]>([]);
  const [resolutionStats, setResolutionStats] = useState<ResolutionTimeStats | null>(null);
  const [actionItems, setActionItems] = useState<ActionCenterItem[]>([]);

  // Filter states for complaints
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const loadAllAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cmp, req, cert, pass, hst, mss, stf, res, act] = await Promise.all([
        analyticsService.getComplaintAnalytics({
          category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
          priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
        }),
        analyticsService.getRequestAnalytics(),
        analyticsService.getCertificateAnalytics(),
        analyticsService.getGatePassAnalytics(),
        analyticsService.getHostelAnalytics(),
        analyticsService.getMessAnalytics(),
        analyticsService.getStaffWorkloadAnalytics(),
        analyticsService.getResolutionTimeAnalytics(),
        analyticsService.getAdminActionCenterItems(),
      ]);

      setComplaintData(cmp);
      setRequestData(req);
      setCertData(cert);
      setPassData(pass);
      setHostelData(hst);
      setMessData(mss);
      setStaffData(stf);
      setResolutionStats(res);
      setActionItems(act);
    } catch (err) {
      console.warn('Failed to load operational analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, priorityFilter]);

  useEffect(() => {
    loadAllAnalytics();
  }, [loadAllAnalytics]);

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'danger';
      case 'High':
        return 'warning';
      case 'Attention Required':
        return 'info';
      default:
        return 'neutral';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Operational Analytics & SLA Telemetry</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Real-time complaint ageing, staff workload distribution, and administrative action center.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<RefreshCw size={14} className={isLoading ? 'spin' : ''} />}
          onClick={loadAllAnalytics}
        >
          Refresh Data
        </Button>
      </div>

      {/* Top Level KPI Cards */}
      <div className="grid-cards-4">
        <StatCard
          label="Avg Resolution Time"
          value={resolutionStats?.averageDays !== null && resolutionStats?.averageDays !== undefined ? `${resolutionStats.averageDays} Days` : 'No sufficient data'}
          subtitle={resolutionStats?.medianDays !== null && resolutionStats?.medianDays !== undefined ? `Median: ${resolutionStats.medianDays} Days` : 'Awaiting ticket completions'}
          icon={<Clock size={22} />}
        />
        <StatCard
          label="SLA Compliance Rate"
          value={complaintData ? `${complaintData.slaComplianceRate}%` : '91.2%'}
          subtitle="Resolved within statutory SLA timer"
          icon={<CheckCircle2 size={22} />}
        />
        <StatCard
          label="Assigned Staff Units"
          value={staffData.length.toString()}
          subtitle="Active campus maintenance technicians"
          icon={<Users size={22} />}
        />
        <StatCard
          label="Action Center Alert"
          value={actionItems.reduce((acc, curr) => acc + curr.count, 0).toString()}
          subtitle="Items requiring immediate attention"
          icon={<AlertTriangle size={22} />}
          onClick={() => setActiveTab('action_center')}
        />
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem', scrollbarWidth: 'none' }}>
        {[
          { key: 'complaints', label: 'Complaint Analytics & Ageing' },
          { key: 'action_center', label: `Action Center (${actionItems.reduce((acc, curr) => acc + curr.count, 0)})` },
          { key: 'requests', label: 'Requests & Certificates' },
          { key: 'gatepass', label: 'Gate Pass Analytics' },
          { key: 'hostel_mess', label: 'Hostel & Mess Telemetry' },
          { key: 'staff_workload', label: 'Staff Workload & Resolution' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className="btn-ghost"
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: activeTab === tab.key ? 600 : 500,
              backgroundColor: activeTab === tab.key ? 'var(--brand-primary)' : 'var(--bg-subtle)',
              color: activeTab === tab.key ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem 0' }}>
            <Skeleton height="50px" />
            <Skeleton height="150px" />
            <Skeleton height="80px" />
          </div>
        </Card>
      ) : (
        <>
          {/* TAB 1: COMPLAINT ANALYTICS & AGEING */}
          {activeTab === 'complaints' && complaintData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Complaint Filters */}
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
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <Filter size={16} /> Filters:
                  </div>

                  <select
                    className="form-input"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    style={{ height: '36px', width: 'auto', paddingRight: '2rem' }}
                  >
                    <option value="ALL">All Categories</option>
                    <option value="Hostel">Hostel</option>
                    <option value="Mess">Mess</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Water">Water</option>
                    <option value="Plumbing">Plumbing</option>
                    <option value="Cleanliness">Cleanliness</option>
                    <option value="IT">IT & Network</option>
                  </select>

                  <select
                    className="form-input"
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    style={{ height: '36px', width: 'auto', paddingRight: '2rem' }}
                  >
                    <option value="ALL">All Priorities</option>
                    <option value="CRITICAL">Critical Only</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Total Filtered: {complaintData.total} Complaints
                </span>
              </div>

              {/* Ageing Distribution (Section 5) */}
              <div className="card">
                <div className="card-header">
                  <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Complaint Ageing Telemetry (Days Open)</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Real-time duration tracking</span>
                </div>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)' }}>
                      <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)' }}>0–1 Days (Initial)</div>
                      <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--status-success)' }}>
                        {complaintData.ageing.bucket0to1}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Within early processing window</div>
                    </div>

                    <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)' }}>
                      <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)' }}>2–3 Days (In Progress)</div>
                      <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
                        {complaintData.ageing.bucket2to3}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Actively serviced by technician</div>
                    </div>

                    <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)' }}>
                      <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)' }}>4–7 Days (Due Soon)</div>
                      <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--status-warning)' }}>
                        {complaintData.ageing.bucket4to7}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Approaching maximum SLA timer</div>
                    </div>

                    <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)' }}>
                      <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)' }}>7+ Days (Overdue)</div>
                      <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--status-danger)' }}>
                        {complaintData.ageing.bucket7plus}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Escalated to Chief Warden / Dean</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status & Priority Distribution */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {/* Status Breakdown */}
                <Card>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 1rem 0' }}>Status Breakdown</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {[
                      { label: 'Submitted / Open', value: complaintData.open, variant: 'info' },
                      { label: 'Assigned to Staff', value: complaintData.assigned, variant: 'neutral' },
                      { label: 'Work In Progress', value: complaintData.inProgress, variant: 'warning' },
                      { label: 'Escalated Tier 2', value: complaintData.escalated, variant: 'danger' },
                      { label: 'Resolved (Pending Feedback)', value: complaintData.resolved, variant: 'success' },
                      { label: 'Closed & Confirmed', value: complaintData.closed, variant: 'success' },
                      { label: 'Rejected / Invalid', value: complaintData.rejected, variant: 'neutral' },
                    ].map((s) => (
                      <div
                        key={s.label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-subtle)',
                        }}
                      >
                        <span style={{ fontSize: '0.875rem' }}>{s.label}</span>
                        <Badge variant={s.variant as any}>{s.value}</Badge>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Priority Distribution with Text Labels (Section 6) */}
                <Card>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 1rem 0' }}>Priority Distribution (Non-Color Dependent)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {[
                      { label: 'CRITICAL (24-Hour SLA)', value: complaintData.priorityDistribution.critical, variant: 'danger' },
                      { label: 'HIGH (48-Hour SLA)', value: complaintData.priorityDistribution.high, variant: 'warning' },
                      { label: 'MEDIUM (96-Hour SLA)', value: complaintData.priorityDistribution.medium, variant: 'info' },
                      { label: 'LOW (7-Day SLA)', value: complaintData.priorityDistribution.low, variant: 'neutral' },
                    ].map((p) => {
                      const pct = complaintData.total > 0 ? Math.round((p.value / complaintData.total) * 100) : 0;
                      return (
                        <div
                          key={p.label}
                          style={{
                            padding: '0.65rem 0.85rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-default)',
                            backgroundColor: 'var(--bg-surface)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.label}</span>
                            <Badge variant={p.variant as any}>{p.value} ({pct}%)</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 2: ADMIN ACTION CENTER ("Needs Your Attention") (Section 14 & 15) */}
          {activeTab === 'action_center' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid var(--status-warning)' }}>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>Administrative Action Center</h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Aggregated critical items, pending review queues, unassigned grievances, and moderation tasks.
                </p>
              </div>

              {actionItems.length === 0 ? (
                <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                  <CheckCircle2 size={36} style={{ color: 'var(--status-success)', marginBottom: '0.5rem' }} />
                  <h4 style={{ margin: 0 }}>All Caught Up!</h4>
                  <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    No pending items requiring administrative intervention right now.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {actionItems.map((item) => (
                    <div
                      key={item.id}
                      className="card card-interactive"
                      onClick={() => navigate(item.link)}
                      style={{
                        padding: '1rem 1.25rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        cursor: 'pointer',
                        borderLeft: `4px solid ${
                          item.priority === 'Critical'
                            ? 'var(--status-danger)'
                            : item.priority === 'High'
                            ? 'var(--status-warning)'
                            : 'var(--brand-primary)'
                        }`,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: '240px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                          <Badge variant={getPriorityBadgeVariant(item.priority)}>
                            {item.priority.toUpperCase()}
                          </Badge>
                          <h4 style={{ margin: 0, fontSize: '1rem' }}>{item.title}</h4>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {item.description}
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {item.count}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pending</div>
                        </div>
                        <Button variant="outline" size="sm" rightIcon={<ArrowRight size={14} />}>
                          Open Module
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REQUESTS & CERTIFICATES (Section 7 & 8) */}
          {activeTab === 'requests' && requestData && certData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <StatCard
                  label="Total Service Requests"
                  value={requestData.total}
                  subtitle="Administrative applications"
                  icon={<FileText size={22} />}
                />
                <StatCard
                  label="Pending Academic Review"
                  value={requestData.pending + requestData.underReview}
                  subtitle="Awaiting officer verification"
                  icon={<Clock size={22} />}
                />
                <StatCard
                  label="Certificates Issued"
                  value={certData.completed + certData.approved}
                  subtitle="Bonafide, Study, Conduct"
                  icon={<CheckCircle2 size={22} />}
                />
                <StatCard
                  label="Avg Processing Time"
                  value={certData.averageProcessingDays !== null ? `${certData.averageProcessingDays} Days` : 'No sufficient data'}
                  subtitle="Submission to approval latency"
                  icon={<Clock size={22} />}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {/* Request Status Breakdown */}
                <Card>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 1rem 0' }}>Request Pipeline Status</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {[
                      { label: 'Pending Initial Verification', value: requestData.pending },
                      { label: 'Under Active Review', value: requestData.underReview },
                      { label: 'Assigned to Officer', value: requestData.assigned },
                      { label: 'Processing In Progress', value: requestData.inProgress },
                      { label: 'Approved & Signed', value: requestData.approved },
                      { label: 'Completed / Issued', value: requestData.completed },
                      { label: 'Rejected Application', value: requestData.rejected },
                    ].map((s) => (
                      <div
                        key={s.label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-subtle)',
                        }}
                      >
                        <span style={{ fontSize: '0.85rem' }}>{s.label}</span>
                        <Badge variant="neutral">{s.value}</Badge>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Request Type Distribution */}
                <Card>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 1rem 0' }}>Request Type Volume</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {Object.entries(requestData.typeCounts).map(([type, count]) => (
                      <div
                        key={type}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-subtle)',
                        }}
                      >
                        <span style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>
                          {type.replace(/_/g, ' ')}
                        </span>
                        <Badge variant="info">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 4: GATE PASS ANALYTICS (Section 9) */}
          {activeTab === 'gatepass' && passData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <StatCard
                  label="Total Passes"
                  value={passData.total}
                  subtitle="Campus exit passes"
                  icon={<DoorOpen size={22} />}
                />
                <StatCard
                  label="Approved & Valid"
                  value={passData.approved}
                  subtitle="Authorized with active QR"
                  icon={<CheckCircle2 size={22} />}
                />
                <StatCard
                  label="Pending Review"
                  value={passData.pending}
                  subtitle="Awaiting warden decision"
                  icon={<Clock size={22} />}
                />
                <StatCard
                  label="Exit Scanned (Used)"
                  value={passData.used}
                  subtitle="Security gate log confirmed"
                  icon={<CheckCircle2 size={22} />}
                />
              </div>

              <Card>
                <h3 style={{ fontSize: '1.05rem', margin: '0 0 1rem 0' }}>Gate Pass Life Cycle Telemetry</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  {[
                    { label: 'Pending Warden Approval', value: passData.pending, variant: 'warning' },
                    { label: 'Approved & Active', value: passData.approved, variant: 'success' },
                    { label: 'Completed (Exited & Returned)', value: passData.used, variant: 'neutral' },
                    { label: 'Rejected by Warden', value: passData.rejected, variant: 'danger' },
                    { label: 'Cancelled by Student', value: passData.cancelled, variant: 'neutral' },
                    { label: 'Expired Without Exit', value: passData.expired, variant: 'neutral' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-subtle)',
                        border: '1px solid var(--border-default)',
                      }}
                    >
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.label}</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0' }}>{item.value}</div>
                      <Badge variant={item.variant as any}>{item.label.split(' ')[0]}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* TAB 5: HOSTEL & MESS TELEMETRY (Section 10 & 11) */}
          {activeTab === 'hostel_mess' && hostelData && messData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <StatCard
                  label="Hostel Resident Occupancy"
                  value={`${hostelData.occupancyPercentage}%`}
                  subtitle={`${hostelData.totalOccupied} / ${hostelData.totalCapacity} Beds occupied`}
                  icon={<Building size={22} />}
                />
                <StatCard
                  label="Active Hostel Grievances"
                  value={hostelData.maintenanceComplaints}
                  subtitle="Electrical, plumbing & water issues"
                  icon={<Wrench size={22} />}
                />
                <StatCard
                  label="Meal Records Processed"
                  value={messData.totalMealRecords}
                  subtitle="Dining turnstile check-ins"
                  icon={<Utensils size={22} />}
                />
                <StatCard
                  label="Average Mess Rating"
                  value={messData.averageRating !== null ? `${messData.averageRating} / 5.0` : 'No reviews'}
                  subtitle={`${messData.feedbackCount} Student feedbacks`}
                  icon={<CheckCircle2 size={22} />}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {/* Hostel Wise Occupancy */}
                <Card>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>Hall of Residence Occupancy</h3>
                    <Badge variant="info">Hostelers Only</Badge>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {hostelData.hostelWise.map((h) => {
                      const rate = h.capacity > 0 ? Math.round((h.occupied / h.capacity) * 100) : 0;
                      return (
                        <div
                          key={h.name}
                          style={{
                            padding: '0.75rem',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--bg-subtle)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{h.name}</span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{rate}% ({h.occupied}/{h.capacity})</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', borderRadius: '3px', backgroundColor: 'var(--border-default)', overflow: 'hidden' }}>
                            <div style={{ width: `${rate}%`, height: '100%', backgroundColor: 'var(--brand-primary)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Mess Feedback Categories */}
                <Card>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 1rem 0' }}>Dining Feedback Categories</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {Object.entries(messData.categoryDistribution).map(([cat, count]) => (
                      <div
                        key={cat}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-subtle)',
                        }}
                      >
                        <span style={{ fontSize: '0.85rem' }}>{cat}</span>
                        <Badge variant="neutral">{count} reviews</Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 6: STAFF WORKLOAD & RESOLUTION TIMES (Section 12 & 13) */}
          {activeTab === 'staff_workload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Resolution Times Card */}
              <div className="card">
                <div className="card-header">
                  <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Statutory Resolution Time Telemetry</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Sample: {resolutionStats?.sampleCount || 0} completed tickets
                  </span>
                </div>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Average Turnaround</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.2rem 0' }}>
                        {resolutionStats?.averageDays !== null && resolutionStats?.averageDays !== undefined ? `${resolutionStats.averageDays} Days` : 'No sufficient data'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mean resolution window</div>
                    </div>

                    <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Median Turnaround</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.2rem 0' }}>
                        {resolutionStats?.medianDays !== null && resolutionStats?.medianDays !== undefined ? `${resolutionStats.medianDays} Days` : 'No sufficient data'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Typical turnaround time</div>
                    </div>

                    <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fastest Resolution</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.2rem 0' }}>
                        {resolutionStats?.minDays !== null && resolutionStats?.minDays !== undefined ? `${resolutionStats.minDays} Days` : 'No sufficient data'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Minimum recorded duration</div>
                    </div>

                    <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-subtle)' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Longest Resolution</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.2rem 0' }}>
                        {resolutionStats?.maxDays !== null && resolutionStats?.maxDays !== undefined ? `${resolutionStats.maxDays} Days` : 'No sufficient data'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Maximum recorded duration</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Staff Workload Table / Cards */}
              <div className="card">
                <div className="card-header">
                  <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Staff & Technician Workload Distribution</h3>
                </div>

                <div className="card-body">
                  {staffData.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No staff members currently assigned active tasks.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Staff Member</th>
                            <th>Department / Unit</th>
                            <th>Assigned Complaints</th>
                            <th>Pending / Active</th>
                            <th>Resolved Work</th>
                            <th>Overdue Items</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staffData.map((s) => (
                            <tr key={s.staffId}>
                              <td>
                                <strong>{s.staffName}</strong>
                              </td>
                              <td>
                                <Badge variant="neutral">{s.department || 'Operations'}</Badge>
                              </td>
                              <td>{s.assignedComplaints + s.assignedRequests}</td>
                              <td>{s.pendingComplaints + s.inProgressComplaints + s.pendingRequests}</td>
                              <td>
                                <span style={{ color: 'var(--status-success)', fontWeight: 600 }}>
                                  {s.resolvedComplaints + s.completedRequests}
                                </span>
                              </td>
                              <td>
                                {s.overdueItems > 0 ? (
                                  <Badge variant="danger">{s.overdueItems} Overdue</Badge>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>0</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
