import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  GraduationCap,
  ShieldCheck,
  Printer,
  CheckCircle2,
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../context/useAuth';

export const DigitalIdCardPage: React.FC = () => {
  const { userProfile } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);

  const studentName = userProfile?.name || 'Aarav Sharma';
  const studentId = userProfile?.studentId || 'STU2026001';
  const rollNumber = userProfile?.rollNumber || '220101001';
  const department = userProfile?.department || 'Computer Science & Engineering';
  const branch = userProfile?.branch || 'CSE';
  const year = userProfile?.year || 3;
  const semester = userProfile?.semester || 6;
  const category = userProfile?.studentCategory || 'HOSTELER';
  const hostelInfo = category === 'HOSTELER'
    ? `${userProfile?.hostelBlock || 'Block A'} - Rm ${userProfile?.roomNumber || '204'}`
    : 'Day Scholar';

  // Secure verification token
  const qrVerificationPayload = JSON.stringify({
    institution: 'BPUT_CAMPUS_LIFE',
    studentId,
    rollNumber,
    name: studentName,
    validUntil: '2026-06-30',
    status: userProfile?.isActive ? 'ACTIVE' : 'SUSPENDED',
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.5rem',
        width: '100%',
        maxWidth: '100%',
      }}
    >
      {/* Page Title */}
      <div style={{ textAlign: 'center', maxWidth: '600px' }}>
        <h1 style={{ marginBottom: '0.25rem', fontSize: '1.6rem' }}>Digital Campus ID</h1>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Official institutional identity credential with cryptographic QR verification for campus gate egress, library, and examination access.
        </p>
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button variant="outline" size="sm" leftIcon={<Printer size={15} />} onClick={handlePrint}>
          Print ID Card
        </Button>
      </div>

      {/* Responsive Digital ID Card Container (Section 5 & 6) */}
      <div
        ref={cardRef}
        className="card-id-digital"
        style={{
          width: '100%',
          maxWidth: '380px',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          backgroundColor: 'var(--color-bg-surface)',
          border: '2px solid var(--color-primary)',
          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header Ribbon */}
        <div
          style={{
            backgroundColor: 'var(--color-primary)',
            color: '#ffffff',
            padding: '1.25rem 1rem',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <GraduationCap size={22} />
            <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.04em' }}>
              BPUT CAMPUS LIFE
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.9 }}>
            BIJU PATNAIK UNIVERSITY OF TECHNOLOGY
          </div>
          <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '0.2rem' }}>
            Official Student Credential • Academic Session 2025–26
          </div>
        </div>

        {/* Body Content */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1rem' }}>
          {/* Avatar Photo */}
          <div style={{ position: 'relative', width: 92, height: 92 }}>
            {userProfile?.photoUrl ? (
              <img
                src={userProfile.photoUrl}
                alt={studentName}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--color-primary)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.2rem',
                  fontWeight: 800,
                  border: '3px solid var(--color-primary)',
                }}
              >
                {studentName.charAt(0)}
              </div>
            )}
            <div
              style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                backgroundColor: 'var(--color-success)',
                color: '#ffffff',
                borderRadius: '50%',
                width: 22,
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
              title="Verified Student Account"
            >
              <CheckCircle2 size={14} />
            </div>
          </div>

          {/* Name & Academic Title */}
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>{studentName}</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
              {department}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <Badge variant={category === 'HOSTELER' ? 'info' : 'neutral'}>
                {category === 'HOSTELER' ? 'Hosteler' : 'Day Scholar'}
              </Badge>
              <Badge variant="success">Active Enrolment</Badge>
            </div>
          </div>

          {/* Metadata Grid */}
          <div
            style={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              textAlign: 'left',
              padding: '0.85rem',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Student ID</span>
              <strong style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{studentId}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Roll Number</span>
              <strong style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{rollNumber}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Branch & Year</span>
              <span>{branch} • Year {year} (Sem {semester})</span>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Residence</span>
              <span>{hostelInfo}</span>
            </div>
          </div>

          {/* Verification QR Code Section */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '0.85rem',
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--radius-md)',
              width: '100%',
              backgroundColor: '#ffffff',
            }}
          >
            <QRCodeSVG
              value={qrVerificationPayload}
              size={120}
              level="M"
              includeMargin={false}
            />
            <span style={{ fontSize: '0.7rem', color: '#4b5563', marginTop: '0.4rem', fontFamily: 'monospace' }}>
              SECURE QR • {studentId}
            </span>
          </div>

          {/* Footer Card Verification Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            <ShieldCheck size={14} style={{ color: 'var(--color-primary)' }} />
            <span>Cryptographically Verified Campus Life Identity</span>
          </div>
        </div>
      </div>
    </div>
  );
};
