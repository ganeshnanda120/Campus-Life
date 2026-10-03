import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Utensils,
  MessageSquare,
  Clock,
  Sparkles,
  Star,
  RefreshCw,
  Bell,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { StatCard, Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { Skeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../context/useAuth';
import {
  messService,
  MEAL_TIMINGS,
} from '../../services/messService';
import type {
  MessMenuItem,
  MessAnnouncement,
  MessFeedback,
  MealRecord,
  MealType,
  MessFeedbackCategory,
} from '../../types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const MessPage: React.FC = () => {
  const { userProfile, role, permissions } = useAuth();
  const navigate = useNavigate();

  const isDayScholar = userProfile?.studentCategory === 'DAY_SCHOLAR';
  const isAdminOrStaff =
    role === 'MAIN_ADMIN' ||
    (role === 'SUB_ADMIN' && permissions.includes('MANAGE_MESS')) ||
    role === 'STAFF';

  const [menu, setMenu] = useState<MessMenuItem[]>([]);
  const [announcements, setAnnouncements] = useState<MessAnnouncement[]>([]);
  const [feedbacks, setFeedbacks] = useState<MessFeedback[]>([]);
  const [myMeals, setMyMeals] = useState<MealRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selected Day & Facility
  const todayDayName = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const [selectedDay, setSelectedDay] = useState<string>(todayDayName || 'Saturday');
  const [selectedFacility, setSelectedFacility] = useState('Central Dining Hall 1 & 2');

  // Feedback Modal State
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackCat, setFeedbackCat] = useState<MessFeedbackCategory>('Food Quality');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [isSubmittingFb, setIsSubmittingFb] = useState(false);

  // Admin Announcement Modal
  const [isAnnounceModalOpen, setIsAnnounceModalOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annMsg, setAnnMsg] = useState('');
  const [annType, setAnnType] = useState<MessAnnouncement['type']>('MENU_CHANGE');

  // Meal Status Recording Modal
  const [isMealModalOpen, setIsMealModalOpen] = useState(false);
  const [mealStudentRoll, setMealStudentRoll] = useState('220101001');
  const [mealStudentName, setMealStudentName] = useState('Aarav Sharma');
  const [mealTypeToRecord, setMealTypeToRecord] = useState<MealType>('LUNCH');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadMessData = useCallback(async () => {
    setIsLoading(true);
    try {
      const menuData = await messService.getMenu();
      setMenu(menuData);

      const annData = await messService.getAnnouncements();
      setAnnouncements(annData);

      if (userProfile?.uid && !isDayScholar) {
        const records = await messService.getStudentMealRecords(userProfile.uid);
        setMyMeals(records);
      }

      if (isAdminOrStaff) {
        const fbData = await messService.getFeedbacks();
        setFeedbacks(fbData);
      }
    } catch (err) {
      console.warn('Failed to load mess data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userProfile?.uid, isDayScholar, isAdminOrStaff]);

  useEffect(() => {
    loadMessData();
  }, [loadMessData]);

  // Submit Feedback
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackComment.trim()) {
      alert('Please enter your feedback comments.');
      return;
    }

    setIsSubmittingFb(true);
    try {
      await messService.submitFeedback({
        studentId: userProfile?.uid || 'student_uid_001',
        studentName: userProfile?.name || 'Resident Student',
        facility: selectedFacility,
        category: feedbackCat,
        rating: feedbackRating,
        comment: feedbackComment.trim(),
      });

      setIsFeedbackModalOpen(false);
      setFeedbackComment('');
      setToastMessage('Thank you! Your dining feedback has been recorded for the mess committee.');
      setTimeout(() => setToastMessage(null), 5000);
      loadMessData();
    } catch (err: any) {
      alert(err.message || 'Failed to submit feedback.');
    } finally {
      setIsSubmittingFb(false);
    }
  };

  // Create Announcement
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annMsg.trim()) return;

    try {
      await messService.addAnnouncement(
        {
          title: annTitle.trim(),
          message: annMsg.trim(),
          type: annType,
          facility: selectedFacility,
          postedBy: userProfile?.name || 'Mess Supervisor',
        },
        {
          uid: userProfile?.uid || 'admin_001',
          name: userProfile?.name || 'Mess Supervisor',
          role: role || 'STAFF',
        }
      );

      setIsAnnounceModalOpen(false);
      setAnnTitle('');
      setAnnMsg('');
      setToastMessage('Mess announcement posted successfully.');
      setTimeout(() => setToastMessage(null), 5000);
      loadMessData();
    } catch (err: any) {
      alert(err.message || 'Failed to post announcement.');
    }
  };

  // Record Meal Status
  const handleRecordMeal = async () => {
    try {
      await messService.recordMealStatus({
        studentId: userProfile?.uid || 'student_uid_001',
        studentName: mealStudentName,
        mealType: mealTypeToRecord,
        status: 'TAKEN',
        recordedBy: userProfile?.name || 'Mess Attendant',
      });

      setIsMealModalOpen(false);
      setToastMessage(`Recorded ${mealTypeToRecord} meal attendance for ${mealStudentName}.`);
      setTimeout(() => setToastMessage(null), 5000);
      loadMessData();
    } catch (err: any) {
      alert(err.message || 'Failed to record meal.');
    }
  };

  // If student is DAY_SCHOLAR, show clear restriction message
  if (role === 'STUDENT' && isDayScholar) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '840px', margin: '0 auto', width: '100%' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Campus Mess & Dining</h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Daily menus, residential meal planning, and catering operations.
          </p>
        </div>

        <Card>
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <Utensils size={48} style={{ color: 'var(--color-text-muted)', margin: '0 auto 1rem auto' }} />
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Day Scholar Account</h3>
            <p style={{ maxWidth: '520px', margin: '0 auto 1.5rem auto', color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              You are currently registered as a <strong>Day Scholar</strong>. Residential campus dining hall subscriptions and weekly meal schedules are provided for on-campus residents. Day scholars wishing to obtain guest meal coupons can visit the Central Accounts Office.
            </p>
            <Button
              variant="primary"
              onClick={() => navigate('/service-directory')}
            >
              Explore Campus Canteens & Cafeterias
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Filter menu items for selected day
  const dayMenuItems = menu.filter((m) => m.dayOfWeek.toLowerCase() === selectedDay.toLowerCase());

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
          <h1 style={{ marginBottom: '0.25rem' }}>Campus Dining & Mess Operations</h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Deterministic daily meal menus, dietary schedules, catering announcements, and verified student feedback.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw size={14} className={isLoading ? 'spin' : ''} />}
            onClick={loadMessData}
          >
            Refresh
          </Button>

          {!isDayScholar && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<MessageSquare size={15} />}
              onClick={() => setIsFeedbackModalOpen(true)}
            >
              Submit Mess Feedback
            </Button>
          )}

          {isAdminOrStaff && (
            <>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Plus size={15} />}
                onClick={() => setIsAnnounceModalOpen(true)}
              >
                Post Announcement
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<CheckCircle2 size={15} />}
                onClick={() => setIsMealModalOpen(true)}
              >
                Record Meal Distribution
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Operational Stats */}
      <div className="grid-cards">
        <StatCard
          label="Active Dining Facility"
          value="Dining Hall 1 & 2"
          subtitle="Aryabhatta & Kalam central wings"
          icon={<Utensils size={22} style={{ color: 'var(--brand-primary)' }} />}
        />
        <StatCard
          label="Today's Meal Timings"
          value="Active Schedule"
          subtitle="B: 7:30–9:30 | L: 12:30–2:30 | D: 8–10"
          icon={<Clock size={22} style={{ color: 'var(--color-success, #16a34a)' }} />}
        />
        <StatCard
          label="My Meal Status Today"
          value={myMeals.length > 0 ? `${myMeals.length} Meals Recorded` : 'No Check-ins'}
          subtitle="Biometric coupon verified"
          icon={<CheckCircle2 size={22} style={{ color: 'var(--color-warning, #d97706)' }} />}
        />
      </div>

      {/* Facility & Day Navigation */}
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Facility Selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Dining Facility:</span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {['Central Dining Hall 1 & 2', 'Aryabhatta Hall Dining', 'Kalam Hall Dining'].map((fac) => (
                <button
                  key={fac}
                  type="button"
                  onClick={() => setSelectedFacility(fac)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: '1px solid var(--border-default)',
                    backgroundColor: selectedFacility === fac ? 'var(--brand-primary)' : 'var(--bg-surface)',
                    color: selectedFacility === fac ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {fac}
                </button>
              ))}
            </div>
          </div>

          {/* Day Selector Pills */}
          <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            {DAYS.map((day) => {
              const isSelected = selectedDay === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    backgroundColor: isSelected ? 'var(--brand-primary)' : 'var(--bg-subtle)',
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: isSelected ? 600 : 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Menu Cards (Breakfast, Lunch, Snacks, Dinner) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {(['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'] as MealType[]).map((mealType) => {
          const item = dayMenuItems.find((m) => m.mealType === mealType);
          const timingInfo = MEAL_TIMINGS[mealType];

          return (
            <Card key={mealType}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--brand-primary)' }}>
                    {timingInfo.label}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {timingInfo.timing}
                  </span>
                </div>
                {item?.specialItem && (
                  <Badge variant="warning">
                    <Sparkles size={11} /> {item.specialItem}
                  </Badge>
                )}
              </div>

              {isLoading ? (
                <Skeleton height="70px" />
              ) : item ? (
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                  {item.menu}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  Standard institutional diet menu prepared by mess committee.
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {/* Mess Announcements (Section 31) */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Bell size={18} style={{ color: 'var(--brand-primary)' }} />
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Catering Notices & Dining Announcements</h3>
        </div>

        {announcements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-muted)' }}>
            No current mess announcements.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {announcements.map((ann) => (
              <div
                key={ann.id}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-subtle)',
                  borderLeft: '4px solid var(--brand-primary)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{ann.title}</h4>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{ann.date}</span>
                    <Badge variant="info">{ann.type.replace('_', ' ')}</Badge>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {ann.message}
                </p>
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Posted by: {ann.postedBy} • {ann.facility}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Admin Feedback Review Section */}
      {isAdminOrStaff && feedbacks.length > 0 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Student Mess Feedback Submissions</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Audited catering satisfaction records</span>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Category</th>
                  <th>Rating</th>
                  <th>Comments</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {feedbacks.map((fb) => (
                  <tr key={fb.id}>
                    <td style={{ fontWeight: 600 }}>{fb.studentName}</td>
                    <td>{fb.category}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                        {[...Array(fb.rating)].map((_, i) => (
                          <Star key={i} size={14} fill="#f59e0b" color="#f59e0b" />
                        ))}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>"{fb.comment}"</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      {new Date(fb.submittedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Submit Mess Feedback Modal */}
      <Modal
        isOpen={isFeedbackModalOpen}
        onClose={() => !isSubmittingFb && setIsFeedbackModalOpen(false)}
        title="Submit Dining Feedback"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', width: '100%' }}>
            <Button variant="outline" onClick={() => setIsFeedbackModalOpen(false)} disabled={isSubmittingFb}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmitFeedback} disabled={isSubmittingFb}>
              {isSubmittingFb ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmitFeedback} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Feedback Category *
            </label>
            <select
              className="input-field"
              value={feedbackCat}
              onChange={(e) => setFeedbackCat(e.target.value as MessFeedbackCategory)}
            >
              <option value="Food Quality">Food Quality & Taste</option>
              <option value="Menu">Menu Variation & Options</option>
              <option value="Cleanliness">Dining Hall Cleanliness & Hygiene</option>
              <option value="Timing">Serving Timings & Punctuality</option>
              <option value="General">General / Other Suggestions</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Rating *
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="btn-ghost"
                  onClick={() => setFeedbackRating(star)}
                  style={{ padding: '4px' }}
                  aria-label={`Rate ${star} stars`}
                >
                  <Star
                    size={24}
                    fill={star <= feedbackRating ? '#f59e0b' : 'none'}
                    color="#f59e0b"
                  />
                </button>
              ))}
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--brand-primary)', marginLeft: '0.5rem' }}>
                {feedbackRating} of 5 Stars
              </span>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Detailed Feedback Comments *
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="What went well? Any items that need improvement?..."
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              required
            />
          </div>
        </form>
      </Modal>

      {/* Admin Post Announcement Modal */}
      <Modal
        isOpen={isAnnounceModalOpen}
        onClose={() => setIsAnnounceModalOpen(false)}
        title="Post Mess Announcement"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', width: '100%' }}>
            <Button variant="outline" onClick={() => setIsAnnounceModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateAnnouncement}>Publish Announcement</Button>
          </div>
        }
      >
        <form onSubmit={handleCreateAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Announcement Type
            </label>
            <select
              className="input-field"
              value={annType}
              onChange={(e) => setAnnType(e.target.value as any)}
            >
              <option value="MENU_CHANGE">Menu Change</option>
              <option value="TIMING_UPDATE">Timing Update</option>
              <option value="SPECIAL_MEAL">Special Meal / Festive Feast</option>
              <option value="CLOSURE">Temporary Closure / Sanitization</option>
              <option value="GENERAL">General Notice</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Announcement Title *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Navratri Special Feast, Dining Hall 2 Sanitization"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Message Details *
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="Complete announcement message..."
              value={annMsg}
              onChange={(e) => setAnnMsg(e.target.value)}
              required
            />
          </div>
        </form>
      </Modal>

      {/* Record Meal Distribution Modal (For Staff) */}
      <Modal
        isOpen={isMealModalOpen}
        onClose={() => setIsMealModalOpen(false)}
        title="Record Meal Distribution"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', width: '100%' }}>
            <Button variant="outline" onClick={() => setIsMealModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleRecordMeal}>Confirm Check-in</Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Student Roll Number
            </label>
            <input
              type="text"
              className="input-field"
              value={mealStudentRoll}
              onChange={(e) => setMealStudentRoll(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Student Name
            </label>
            <input
              type="text"
              className="input-field"
              value={mealStudentName}
              onChange={(e) => setMealStudentName(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Meal Session
            </label>
            <select
              className="input-field"
              value={mealTypeToRecord}
              onChange={(e) => setMealTypeToRecord(e.target.value as MealType)}
            >
              <option value="BREAKFAST">Breakfast</option>
              <option value="LUNCH">Lunch</option>
              <option value="SNACKS">Evening Snacks</option>
              <option value="DINNER">Dinner</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};
