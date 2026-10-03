import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  MapPin,
  Search,
  CheckCircle,
  Tag,
  X,
  Phone,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/useAuth';
import { lostFoundService } from '../../services/lostFoundService';
import type { LostFoundListing, LostFoundStatus } from '../../types';

export const LostFoundPage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const [items, setItems] = useState<LostFoundListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'LOST' | 'FOUND'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState<'LOST' | 'FOUND'>('LOST');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Electronics',
    location: '',
    date: new Date().toISOString().substring(0, 10),
    contactInfo: '',
  });

  const canModerate =
    role === 'MAIN_ADMIN' ||
    role === 'SUB_ADMIN' ||
    role === 'STAFF' ||
    userProfile?.permissions?.includes('MANAGE_LOST_FOUND');

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await lostFoundService.getItems({
        type: typeFilter !== 'ALL' ? typeFilter : undefined,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        search: searchQuery || undefined,
      });
      setItems(data);
    } catch (err) {
      console.warn('Failed to load lost & found items:', err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = lostFoundService.subscribeItems((allItems) => {
      let filtered = allItems;
      if (typeFilter !== 'ALL') {
        filtered = filtered.filter((i) => i.type === typeFilter);
      }
      if (categoryFilter !== 'ALL') {
        filtered = filtered.filter((i) => i.category === categoryFilter);
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (i) =>
            i.title.toLowerCase().includes(q) ||
            i.description.toLowerCase().includes(q) ||
            i.location.toLowerCase().includes(q)
        );
      }
      setItems(filtered);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [typeFilter, categoryFilter, searchQuery]);

  const handleOpenReport = (type: 'LOST' | 'FOUND') => {
    setReportType(type);
    setReportModalOpen(true);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setIsSubmitting(true);
    try {
      await lostFoundService.reportItem(
        {
          type: reportType,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          location: formData.location,
          date: formData.date,
          contactInfo: formData.contactInfo || `${userProfile.name} (${userProfile.email})`,
        },
        userProfile
      );

      setReportModalOpen(false);
      setFormData({
        title: '',
        description: '',
        category: 'Electronics',
        location: '',
        date: new Date().toISOString().substring(0, 10),
        contactInfo: '',
      });
      await loadItems();
    } catch (err) {
      console.error('Failed to report item:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (itemId: string, newStatus: LostFoundStatus) => {
    if (!userProfile) return;
    try {
      await lostFoundService.updateItemStatus(itemId, newStatus, userProfile);
      setItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, status: newStatus } : item))
      );
    } catch (err) {
      console.error('Failed to change status:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Campus Lost & Found</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Report misplaced belongings or register retrieved items across university facilities.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            leftIcon={<Plus size={16} />}
            onClick={() => handleOpenReport('FOUND')}
          >
            Report Found Item
          </Button>
          <Button
            variant="primary"
            leftIcon={<Plus size={16} />}
            onClick={() => handleOpenReport('LOST')}
          >
            Report Lost Item
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
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
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: '240px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search items by name or location..."
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

          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setTypeFilter('ALL')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.825rem',
                backgroundColor: typeFilter === 'ALL' ? 'var(--brand-primary)' : 'var(--bg-subtle)',
                color: typeFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
              }}
            >
              All Items
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setTypeFilter('LOST')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.825rem',
                backgroundColor: typeFilter === 'LOST' ? 'var(--status-danger)' : 'var(--bg-subtle)',
                color: typeFilter === 'LOST' ? '#ffffff' : 'var(--text-secondary)',
              }}
            >
              Lost
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setTypeFilter('FOUND')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.825rem',
                backgroundColor: typeFilter === 'FOUND' ? 'var(--status-success)' : 'var(--bg-subtle)',
                color: typeFilter === 'FOUND' ? '#ffffff' : 'var(--text-secondary)',
              }}
            >
              Found
            </button>
          </div>

          <select
            className="form-input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ height: '38px', width: 'auto', paddingRight: '2rem' }}
          >
            <option value="ALL">All Categories</option>
            <option value="Electronics">Electronics</option>
            <option value="Personal Belongings">Personal Belongings</option>
            <option value="Documents & Cards">Documents & Cards</option>
            <option value="Books & Stationery">Books & Stationery</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {items.length} records active
        </span>
      </div>

      {/* Item Grid */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading campus lost and found records...
        </div>
      ) : items.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            No listings found matching your search and filter criteria.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {items.map((item) => (
            <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <Badge variant={item.type === 'FOUND' ? 'success' : 'danger'}>
                    {item.type} ITEM
                  </Badge>
                  <Badge variant={item.status === 'CLAIMED' ? 'neutral' : item.status === 'CLAIM_PENDING' ? 'warning' : 'info'}>
                    {item.status.replace('_', ' ')}
                  </Badge>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {item.date}
                </span>
              </div>

              <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem 0' }}>{item.title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.75rem', flex: 1 }}>
                  {item.description}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-subtle)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={14} style={{ color: 'var(--brand-primary)' }} />
                    <span>Location: {item.location}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Tag size={14} />
                    <span>Category: {item.category}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Phone size={14} style={{ color: 'var(--status-success)' }} />
                    <span>Contact: {item.contactInfo}</span>
                  </div>
                </div>
              </div>

              <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  By: {item.submittedByName}
                </span>

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {item.status === 'OPEN' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange(item.id, 'CLAIM_PENDING')}
                    >
                      Request Claim
                    </Button>
                  )}

                  {canModerate && item.status !== 'CLAIMED' && (
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<CheckCircle size={14} />}
                      onClick={() => handleStatusChange(item.id, 'CLAIMED')}
                    >
                      Mark Claimed
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* REPORT MODAL */}
      {reportModalOpen && (
        <div className="modal-backdrop" onClick={() => setReportModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '560px', width: '92%' }}
          >
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>
                {reportType === 'LOST' ? 'Report Lost Personal Belonging' : 'Register Found Item'}
              </h3>
              <button
                type="button"
                className="btn-ghost btn-icon"
                onClick={() => setReportModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReportSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="form-label">Item Name / Title *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Casio Calculator or Blue Milton Bottle"
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
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="Electronics">Electronics</option>
                      <option value="Personal Belongings">Personal Belongings</option>
                      <option value="Documents & Cards">Documents & Cards</option>
                      <option value="Books & Stationery">Books & Stationery</option>
                      <option value="Clothing">Clothing</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Date Incident Occurred *</label>
                    <input
                      type="date"
                      required
                      className="form-input"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Campus Location *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Seminar Hall 2, 3rd row or Central Library"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Description & Distinguishing Features *</label>
                  <textarea
                    required
                    rows={3}
                    className="form-input"
                    placeholder="Color, brand, serial markings, stickers, or case condition..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Custodian Contact / Retrieval Instructions</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Handed over to Security Post 1 or Library Counter"
                    value={formData.contactInfo}
                    onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <Button variant="ghost" type="button" onClick={() => setReportModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" isLoading={isSubmitting}>
                  Submit Report
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
