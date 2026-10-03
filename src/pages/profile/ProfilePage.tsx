import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  User,
  Camera,
  Clock,
  Save,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { Skeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../context/useAuth';
import { userService } from '../../services/userService';
import { activityService } from '../../services/activityService';
import type { UserActivity } from '../../types';

export const ProfilePage: React.FC = () => {
  const { userProfile, role, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable fields state (only student personal fields; admin fields remain strictly immutable)
  const [formData, setFormData] = useState({
    phone: '',
    dob: '',
    gender: 'Male',
    address: '',
    guardianName: '',
    guardianPhone: '',
  });

  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  // Photo upload states
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Form submission states
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize editable fields from userProfile
  useEffect(() => {
    if (userProfile) {
      setFormData({
        phone: userProfile.phone || '',
        dob: userProfile.dob || '',
        gender: userProfile.gender || 'Male',
        address: userProfile.address || '',
        guardianName: userProfile.guardianName || '',
        guardianPhone: userProfile.guardianPhone || '',
      });
      if (userProfile.photoUrl) {
        setPhotoPreview(userProfile.photoUrl);
      }
    }
  }, [userProfile]);

  // Load user activities
  const loadActivities = useCallback(async () => {
    if (!userProfile) return;
    setIsLoadingActivities(true);
    try {
      const data = await activityService.getUserActivities(userProfile.uid, 15);
      setActivities(data);
    } catch (err) {
      console.warn('Failed to load user activities:', err);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [userProfile]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Photo Selection & Validation
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validate mime type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    // Validate size (< 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError('Image file size exceeds the 2MB limit. Please upload a smaller image.');
      return;
    }

    // Read and simulate safe upload with progress bar
    setIsUploading(true);
    setUploadProgress(15);

    const reader = new FileReader();
    reader.onloadstart = () => setUploadProgress(35);
    reader.onprogress = (evt) => {
      if (evt.lengthComputable) {
        const percent = Math.round((evt.loaded / evt.total) * 100);
        setUploadProgress(Math.min(95, percent));
      }
    };
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setUploadProgress(100);
      setPhotoPreview(dataUrl);
      setIsUploading(false);

      // Persist photo URL in user record
      if (userProfile) {
        const actor = {
          uid: userProfile.uid,
          name: userProfile.name,
          role: role || 'STUDENT',
        };
        await userService.updateUser(userProfile.uid, { photoUrl: dataUrl }, actor);
        await activityService.logActivity({
          userId: userProfile.uid,
          title: 'Profile Photo Updated',
          description: 'Uploaded and verified new digital student avatar photo.',
          entityType: 'profile',
        });
        await refreshProfile();
        setToastMessage('Profile photo updated successfully.');
        setTimeout(() => setToastMessage(null), 4000);
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read image file. Please try again.');
      setIsUploading(false);
      setUploadProgress(null);
    };
    reader.readAsDataURL(file);
  };

  // Submit personal details update
  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setIsSaving(true);
    setFormError(null);

    try {
      const actor = {
        uid: userProfile.uid,
        name: userProfile.name,
        role: role || 'STUDENT',
      };

      // Strict enforcement: only submit permissible personal contact updates
      const res = await userService.updateUser(
        userProfile.uid,
        {
          phone: formData.phone.trim() || undefined,
          dob: formData.dob || undefined,
          gender: formData.gender,
          address: formData.address.trim() || undefined,
          guardianName: formData.guardianName.trim() || undefined,
          guardianPhone: formData.guardianPhone.trim() || undefined,
        },
        actor
      );

      if (!res.success) {
        setFormError(res.error || 'Failed to update personal contact info.');
        setIsSaving(false);
        return;
      }

      await activityService.logActivity({
        userId: userProfile.uid,
        title: 'Profile Contact Updated',
        description: 'Updated personal contact telephone and emergency guardian details.',
        entityType: 'profile',
      });

      await refreshProfile();
      setToastMessage('Personal profile details updated successfully.');
      setTimeout(() => setToastMessage(null), 4000);
      loadActivities();
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred while saving profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      {/* Toast Feedback */}
      {toastMessage && (
        <Alert variant="success" title="Success" dismissible onDismiss={() => setToastMessage(null)}>
          {toastMessage}
        </Alert>
      )}

      {/* Header */}
      <div>
        <h1 style={{ marginBottom: '0.25rem' }}>Student Profile & Dossier</h1>
        <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
          Verified university record, academic allocations, and personal contact management.
        </p>
      </div>

      {/* Identity Card Header */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          {/* Avatar with Upload Button */}
          <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
            {photoPreview ? (
              <img
                src={photoPreview}
                alt={userProfile?.name || 'Student Photo'}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 'var(--radius-full)',
                  objectFit: 'cover',
                  border: '3px solid var(--color-border)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-primary)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  fontWeight: 700,
                  border: '3px solid var(--color-border)',
                }}
              >
                {userProfile?.name?.charAt(0) || 'S'}
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              style={{ display: 'none' }}
              aria-label="Upload profile photograph"
            />

            {/* Upload Camera Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Change profile photo"
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                border: '2px solid var(--color-bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <Camera size={16} />
            </button>
          </div>

          {/* Core Info */}
          <div style={{ flex: 1, minWidth: '240px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{userProfile?.name || 'Aarav Sharma'}</h2>
              <Badge variant="success">Active</Badge>
              <Badge variant={userProfile?.studentCategory === 'HOSTELER' ? 'info' : 'neutral'}>
                {userProfile?.studentCategory === 'HOSTELER' ? 'Hosteler' : 'Day Scholar'}
              </Badge>
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>
              ID: <strong>{userProfile?.studentId || 'STU2026001'}</strong> • Roll: <strong>{userProfile?.rollNumber || '220101001'}</strong>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
              {userProfile?.department || 'Computer Science & Engineering'} • {userProfile?.branch || 'CSE'} (Year {userProfile?.year || 3}, Sem {userProfile?.semester || 6})
            </div>
          </div>
        </div>

        {/* Upload Progress Bar / Error */}
        {isUploading && uploadProgress !== null && (
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
              Uploading avatar... {uploadProgress}%
            </div>
            <div style={{ height: 6, width: '100%', backgroundColor: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: 'var(--color-primary)', transition: 'width 0.2s ease' }} />
            </div>
          </div>
        )}

        {uploadError && (
          <div style={{ marginTop: '0.75rem' }}>
            <Alert variant="danger" title="Upload Failed">
              {uploadError}
            </Alert>
          </div>
        )}
      </Card>

      {/* Administrative Fields (Strictly Immutable from Client - Section 3) */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
          <Shield size={18} style={{ color: 'var(--color-primary)' }} />
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Administrator-Controlled Academic Record</h3>
        </div>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          These institutional attributes are controlled by university administration and cannot be modified by students.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            fontSize: '0.85rem',
          }}
        >
          <div>
            <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Email Address</span>
            <strong style={{ fontSize: '0.9rem' }}>{userProfile?.email}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Student ID</span>
            <strong style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{userProfile?.studentId || 'STU2026001'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>University Roll Number</span>
            <strong style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{userProfile?.rollNumber || '220101001'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Department</span>
            <strong>{userProfile?.department || 'Computer Science & Engineering'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Discipline & Branch</span>
            <strong>{userProfile?.branch || 'CSE'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Academic Standing</span>
            <strong>Year {userProfile?.year || 3} • Semester {userProfile?.semester || 6}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Student Category</span>
            <strong>{userProfile?.studentCategory === 'HOSTELER' ? 'Hosteler' : 'Day Scholar'}</strong>
          </div>
          {userProfile?.studentCategory === 'HOSTELER' && (
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Hostel Allocation</span>
              <strong>{userProfile?.hostelName || 'BPUT Hostel'} ({userProfile?.hostelBlock || 'Block A'}, Rm {userProfile?.roomNumber || '204'})</strong>
            </div>
          )}
        </div>
      </Card>

      {/* Editable Personal Contact Information */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
          <User size={18} style={{ color: 'var(--color-primary)' }} />
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Personal Contact Information</h3>
        </div>

        {formError && (
          <div style={{ marginBottom: '1rem' }}>
            <Alert variant="danger" title="Error">
              {formError}
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmitProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
            <div>
              <label className="input-label" htmlFor="prof-phone">Mobile Phone</label>
              <input
                id="prof-phone"
                type="tel"
                className="input-field"
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div>
              <label className="input-label" htmlFor="prof-gender">Gender</label>
              <select
                id="prof-gender"
                className="input-field"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="input-label" htmlFor="prof-dob">Date of Birth</label>
              <input
                id="prof-dob"
                type="date"
                className="input-field"
                value={formData.dob}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
              />
            </div>

            <div>
              <label className="input-label" htmlFor="prof-gname">Parent / Guardian Name</label>
              <input
                id="prof-gname"
                type="text"
                className="input-field"
                placeholder="Guardian Full Name"
                value={formData.guardianName}
                onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
              />
            </div>

            <div>
              <label className="input-label" htmlFor="prof-gphone">Guardian Emergency Phone</label>
              <input
                id="prof-gphone"
                type="tel"
                className="input-field"
                placeholder="+91 98765 00000"
                value={formData.guardianPhone}
                onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label className="input-label" htmlFor="prof-address">Permanent Residential Address</label>
              <textarea
                id="prof-address"
                className="input-field"
                rows={2}
                placeholder="City, District, State, PIN..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <Button variant="primary" type="submit" isLoading={isSaving} leftIcon={<Save size={16} />}>
              Save Contact Information
            </Button>
          </div>
        </form>
      </Card>

      {/* Student Activity Timeline (Section 23) */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>My Activity Timeline</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={loadActivities}>
            <RefreshCw size={14} className={isLoadingActivities ? 'spin' : ''} />
          </Button>
        </div>

        {isLoadingActivities ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Skeleton height="40px" />
            <Skeleton height="40px" />
          </div>
        ) : activities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)' }}>
            No recent activity recorded yet.
          </div>
        ) : (
          <div className="timeline">
            {activities.map((act) => (
              <div key={act.id} className="timeline-step">
                <div className="timeline-dot completed" />
                <div className="timeline-step-title">{act.title}</div>
                <div className="timeline-step-meta">
                  {new Date(act.timestamp).toLocaleDateString()} • {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Category: {act.entityType}
                </div>
                <div className="timeline-step-desc">{act.description}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
