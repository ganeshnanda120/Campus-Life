import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Users,
  X,
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../context/useAuth';
import { pollService } from '../../services/pollService';
import type { CampusPoll } from '../../types';

export const PollsPage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const [polls, setPolls] = useState<CampusPoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingPollId, setVotingPollId] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  // Admin Poll Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    question: '',
    description: '',
    expiryDate: new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10),
    options: ['', ''],
  });

  const canManagePolls =
    role === 'MAIN_ADMIN' ||
    role === 'SUB_ADMIN' ||
    userProfile?.permissions?.includes('MANAGE_POLLS');

  const loadPolls = useCallback(async () => {
    setLoading(true);
    try {
      const data = await pollService.getPolls();
      setPolls(data);
    } catch (err) {
      console.warn('Failed to load polls:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = pollService.subscribePolls((data) => {
      setPolls(data);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleVote = async (pollId: string, optionId: string) => {
    if (!userProfile) return;
    setVotingPollId(pollId);
    setVoteError(null);
    try {
      await pollService.votePoll(pollId, [optionId], userProfile);
      await loadPolls();
    } catch (err: any) {
      setVoteError(err.message || 'Failed to submit vote');
    } finally {
      setVotingPollId(null);
    }
  };

  const handleAddOption = () => {
    if (formData.options.length < 6) {
      setFormData({ ...formData, options: [...formData.options, ''] });
    }
  };

  const handleRemoveOption = (index: number) => {
    if (formData.options.length > 2) {
      const newOpts = [...formData.options];
      newOpts.splice(index, 1);
      setFormData({ ...formData, options: newOpts });
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const newOpts = [...formData.options];
    newOpts[index] = val;
    setFormData({ ...formData, options: newOpts });
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    const cleanOptions = formData.options.filter((o) => o.trim().length > 0);
    if (cleanOptions.length < 2) {
      alert('Please provide at least 2 distinct poll choices.');
      return;
    }

    setIsSubmitting(true);
    try {
      await pollService.createPoll(
        {
          title: formData.title,
          question: formData.question || formData.title,
          description: formData.description,
          expiryDate: new Date(formData.expiryDate).toISOString(),
          options: cleanOptions.map((text, idx) => ({
            id: `opt_${Date.now()}_${idx}`,
            text,
            votes: 0,
          })),
          isActive: true,
          status: 'ACTIVE',
          createdBy: userProfile.uid,
        },
        userProfile
      );

      setCreateModalOpen(false);
      setFormData({
        title: '',
        question: '',
        description: '',
        expiryDate: new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10),
        options: ['', ''],
      });
      await loadPolls();
    } catch (err) {
      console.error('Failed to create poll:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Campus Polls & Student Feedback</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Digital surveys regarding campus catering, library hours, student facilities, and activities.
          </p>
        </div>
        {canManagePolls && (
          <Button
            variant="primary"
            leftIcon={<Plus size={16} />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create New Poll
          </Button>
        )}
      </div>

      {voteError && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--status-danger-bg, #fee2e2)',
            color: 'var(--status-danger, #b91c1c)',
            fontSize: '0.875rem',
            border: '1px solid var(--status-danger)',
          }}
        >
          {voteError}
        </div>
      )}

      {/* Polls Listing */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading active campus surveys...
        </div>
      ) : polls.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            No campus polls currently active. Check back soon!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {polls.map((poll) => {
            const hasVoted = userProfile ? poll.votedUserIds.includes(userProfile.uid) : false;
            const totalVotes = poll.options.reduce((acc, curr) => acc + curr.votes, 0);

            return (
              <div key={poll.id} className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Badge variant={poll.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {poll.status === 'ACTIVE' ? 'ACTIVE SURVEY' : 'CLOSED'}
                    </Badge>
                    {hasVoted && (
                      <Badge variant="info">
                        ✓ Vote Cast
                      </Badge>
                    )}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Closes: {new Date(poll.expiryDate).toLocaleDateString()}
                  </span>
                </div>

                <div className="card-body">
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '0.4rem' }}>{poll.title}</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                    {poll.description}
                  </p>

                  {/* Options List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {poll.options.map((opt) => {
                      const percentage = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;

                      return (
                        <div
                          key={opt.id}
                          style={{
                            position: 'relative',
                            overflow: 'hidden',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-default)',
                            backgroundColor: 'var(--bg-surface)',
                          }}
                        >
                          {/* Progress fill bar if user has voted */}
                          {hasVoted && (
                            <div
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: `${percentage}%`,
                                backgroundColor: 'var(--brand-primary)',
                                opacity: 0.15,
                                transition: 'width 0.4s ease',
                              }}
                            />
                          )}

                          <button
                            type="button"
                            disabled={hasVoted || poll.status !== 'ACTIVE' || votingPollId === poll.id}
                            onClick={() => handleVote(poll.id, opt.id)}
                            style={{
                              position: 'relative',
                              zIndex: 1,
                              width: '100%',
                              padding: '0.85rem 1.15rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: 'transparent',
                              border: 'none',
                              textAlign: 'left',
                              cursor: hasVoted ? 'default' : 'pointer',
                              color: 'inherit',
                              fontSize: '0.925rem',
                            }}
                          >
                            <span style={{ fontWeight: 500, paddingRight: '1rem' }}>{opt.text}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                              {hasVoted ? (
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
                                  {percentage}% ({opt.votes})
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', fontWeight: 600 }}>
                                  Vote
                                </span>
                              )}
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div
                  className="card-footer"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Users size={14} /> Total Responses: {totalVotes}
                  </div>
                  <div>
                    {hasVoted ? (
                      <span style={{ color: 'var(--status-success)' }}>
                        ✓ Your response has been securely recorded
                      </span>
                    ) : (
                      <span>Select an option above to register your vote</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE POLL MODAL */}
      {createModalOpen && (
        <div className="modal-backdrop" onClick={() => setCreateModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '580px', width: '92%' }}
          >
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Create Campus Poll</h3>
              <button
                type="button"
                className="btn-ghost btn-icon"
                onClick={() => setCreateModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePoll}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="form-label">Poll Title *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Weekend Special Mess Menu Preference"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Poll Description *</label>
                  <textarea
                    required
                    rows={2}
                    className="form-input"
                    placeholder="Describe the context or institutional purpose of the poll..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Voting Deadline Date *</label>
                  <input
                    type="date"
                    required
                    className="form-input"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label className="form-label" style={{ margin: 0 }}>Poll Choices / Options *</label>
                    {formData.options.length < 6 && (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={handleAddOption}
                        style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', fontWeight: 600, padding: 0 }}
                      >
                        + Add Choice
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {formData.options.map((opt, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          required
                          className="form-input"
                          placeholder={`Option ${idx + 1}`}
                          value={opt}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                        />
                        {formData.options.length > 2 && (
                          <button
                            type="button"
                            className="btn-ghost btn-icon"
                            onClick={() => handleRemoveOption(idx)}
                            style={{ color: 'var(--status-danger)' }}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <Button variant="ghost" type="button" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" isLoading={isSubmitting}>
                  Publish Poll
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
