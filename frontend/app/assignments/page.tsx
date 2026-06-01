'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { assignmentsApi } from '@/lib/api';
import { useAssignmentStore } from '@/store/assignmentStore';
import { useWebSocket } from '@/lib/useWebSocket';
import { Assignment } from '@/types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

/* ── Empty State illustration (exact Figma match) ── */
function NoAssignmentsSVG() {
  return (
    <svg width="200" height="170" viewBox="0 0 200 170" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Large back circle */}
      <circle cx="100" cy="95" r="72" fill="#EBEBEB"/>
      {/* Document behind */}
      <rect x="68" y="28" width="72" height="90" rx="7" fill="white" stroke="#D9D9D9" strokeWidth="1.2"/>
      <rect x="78" y="42" width="52" height="4.5" rx="2.2" fill="#C5C5C5"/>
      <rect x="78" y="53" width="38" height="3.5" rx="1.7" fill="#DEDEDE"/>
      <rect x="78" y="62" width="44" height="3.5" rx="1.7" fill="#DEDEDE"/>
      <rect x="78" y="71" width="30" height="3.5" rx="1.7" fill="#DEDEDE"/>
      {/* Document in front */}
      <rect x="58" y="38" width="84" height="100" rx="8" fill="white" stroke="#DADADA" strokeWidth="1.4"/>
      <rect x="70" y="53" width="60" height="5" rx="2.5" fill="#B8B8B8"/>
      <rect x="70" y="65" width="46" height="4" rx="2" fill="#E0E0E0"/>
      <rect x="70" y="75" width="52" height="4" rx="2" fill="#E0E0E0"/>
      <rect x="70" y="85" width="38" height="4" rx="2" fill="#E0E0E0"/>
      {/* Magnifier */}
      <circle cx="108" cy="112" r="34" fill="#F0EEFF"/>
      <circle cx="108" cy="112" r="26" fill="#E8E5FF" opacity="0.7"/>
      <circle cx="108" cy="112" r="18" fill="white" opacity="0.9"/>
      {/* X in magnifier */}
      <circle cx="108" cy="112" r="13" fill="#FEECEC"/>
      <path d="M102 106l12 12M114 106l-12 12" stroke="#EF4444" strokeWidth="2.8" strokeLinecap="round"/>
      {/* Handle */}
      <line x1="126" y1="130" x2="138" y2="142" stroke="#BCBCBC" strokeWidth="5" strokeLinecap="round"/>
      {/* Sparkles */}
      <path d="M65 68 L67.5 62 L70 68 L67.5 74Z" fill="#60A5FA" opacity="0.75"/>
      <path d="M152 80 L154 75 L156 80 L154 85Z" fill="#A78BFA" opacity="0.75"/>
      <circle cx="152" cy="110" r="4.5" fill="#93C5FD" opacity="0.6"/>
      <circle cx="68" cy="135" r="3" fill="#C4B5FD" opacity="0.5"/>
      {/* Pencil/pen */}
      <path d="M55 58 Q44 50 50 37 Q56 24 65 30 L90 62" stroke="#555" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      <path d="M55 58 Q52 55 54 51" stroke="#777" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

/* ── Assignment Card ── */
function AssignmentCard({ a, onDelete, onView }: {
  a: Assignment;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    if (menu) document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const fmt = (d: string) => { try { return format(new Date(d), 'dd-MM-yyyy'); } catch { return d; } };

  const statusDot: Record<string, string> = {
    processing: '#3B82F6',
    pending: '#F59E0B',
    failed: '#EF4444',
  };

  return (
    <div
      onClick={() => { if (a.status === 'completed') onView(a._id); }}
      style={{
        background: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: 12,
        padding: '18px 18px 16px',
        cursor: a.status === 'completed' ? 'pointer' : 'default',
        position: 'relative',
        transition: 'box-shadow 0.18s, border-color 0.18s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.09)';
        (e.currentTarget as HTMLDivElement).style.borderColor = '#D1D5DB';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.borderColor = '#E5E7EB';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <h3 style={{ fontWeight: 700, fontSize: 14.5, color: '#111827', margin: 0, lineHeight: 1.3 }}>
              {a.title}
            </h3>
            {a.status !== 'completed' && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 600,
                color: statusDot[a.status] || '#6B7280',
                background: (statusDot[a.status] || '#6B7280') + '15',
                borderRadius: 20, padding: '2px 8px',
                flexShrink: 0,
              }}>
                {a.status === 'processing' && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }}/>
                )}
                {a.status}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: '#6B7280', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span>
              <span style={{ color: '#374151', fontWeight: 500 }}>Assigned on</span>
              {' : '}{fmt(a.createdAt)}
            </span>
            {a.status === 'completed' && (
              <span>
                <span style={{ color: '#374151', fontWeight: 500 }}>Due</span>
                {' : '}{fmt(a.dueDate)}
              </span>
            )}
          </div>
        </div>

        {/* 3-dot menu */}
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); setMenu(m => !m); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 2px', borderRadius: 6,
              color: '#9CA3AF',
              display: 'flex', alignItems: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="3" r="1.3" fill="currentColor"/>
              <circle cx="8" cy="8" r="1.3" fill="currentColor"/>
              <circle cx="8" cy="13" r="1.3" fill="currentColor"/>
            </svg>
          </button>

          {menu && (
            <div className="slide-down" style={{
              position: 'absolute', right: 0, top: 'calc(100% + 4px)',
              background: '#fff',
              border: '1px solid #E5E7EB',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              minWidth: 158,
              zIndex: 50,
              overflow: 'hidden',
            }} onClick={e => e.stopPropagation()}>
              {a.status === 'completed' && (
                <button onClick={() => { onView(a._id); setMenu(false); }} style={menuItemStyle()}>
                  <svg width="13" height="13" fill="none" viewBox="0 0 13 13">
                    <path d="M6.5 2C3.5 2 1 6.5 1 6.5S3.5 11 6.5 11 12 6.5 12 6.5 9.5 2 6.5 2Z" stroke="#374151" strokeWidth="1.3"/>
                    <circle cx="6.5" cy="6.5" r="1.8" stroke="#374151" strokeWidth="1.3"/>
                  </svg>
                  View Assignment
                </button>
              )}
              <button onClick={() => { onDelete(a._id); setMenu(false); }} style={menuItemStyle('#EF4444')}>
                <svg width="13" height="13" fill="none" viewBox="0 0 13 13">
                  <path d="M2 3.5h9M5 3.5V2.5h3v1M5.5 6v3.5M7.5 6v3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <rect x="3" y="3.5" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                </svg>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function menuItemStyle(color?: string): React.CSSProperties {
  return {
    width: '100%', padding: '9px 14px',
    background: 'none', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 13, color: color || '#374151',
    textAlign: 'left', fontFamily: 'inherit',
    transition: 'background 0.1s',
  };
}

/* ── Main Page ── */
export default function AssignmentsPage() {
  const router = useRouter();
  const { assignments, setAssignments, removeAssignment, updateAssignment, isLoading, setLoading } = useAssignmentStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'completed' | 'processing' | 'pending'>('all');

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await assignmentsApi.getAll();
      setAssignments(res.data.data || []);
    } catch {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [setAssignments, setLoading]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const handleWS = useCallback((msg: any) => {
    if (msg.type === 'assignment_update') {
      updateAssignment(msg.assignmentId, {
        status: msg.status,
        ...(msg.resultId ? { resultId: msg.resultId } : {}),
      });
      if (msg.status === 'completed') toast.success('✅ Question paper generated!');
      if (msg.status === 'failed') toast.error('Generation failed: ' + msg.message);
    }
  }, [updateAssignment]);

  useWebSocket(null, handleWS);

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('Delete this assignment?');
    if (!confirmed) return;
    try {
      await assignmentsApi.delete(id);
      removeAssignment(id);
      toast.success('Assignment deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const filtered = assignments.filter(a => {
    const matchSearch = a.title?.toLowerCase().includes(search.toLowerCase()) ||
      a.subject?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || a.status === filter;
    return matchSearch && matchFilter;
  });

  const isEmpty = assignments.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: isEmpty ? '#fff' : '#F2F2F2' }}>
      <Header title="Assignment" />

      {isLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="spin" style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '3px solid #F3F4F6',
              borderTop: '3px solid #E8450A',
            }}/>
            <span style={{ fontSize: 13, color: '#9CA3AF' }}>Loading assignments...</span>
          </div>
        </div>
      ) : isEmpty ? (
        /* ── 0 State ── */
        <div className="fade-in" style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#F5F5F5',
          padding: '40px 24px',
          textAlign: 'center',
        }}>
          <NoAssignmentsSVG />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '20px 0 8px', letterSpacing: '-0.3px' }}>
            No assignments yet
          </h2>
          <p style={{ fontSize: 13.5, color: '#6B7280', maxWidth: 380, lineHeight: 1.65, marginBottom: 28 }}>
            Create your first assignment to start collecting and grading student submissions.
            You can set up rubrics, define marking criteria, and let AI assist with grading.
          </p>
          <button
            onClick={() => router.push('/assignments/create')}
            style={{
              background: '#111827', color: '#fff',
              border: 'none', borderRadius: 30,
              padding: '12px 26px',
              fontSize: 13.5, fontWeight: 600,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.15s',
              boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px rgba(0,0,0,0.2)'; }}
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path d="M6 1.5v9M1.5 6h9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Create Your First Assignment
          </button>
        </div>
      ) : (
        /* ── Filled State ── */
        <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Page header section */}
          <div style={{
            background: '#fff',
            borderBottom: '1px solid #E5E7EB',
            padding: '16px 24px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block', flexShrink: 0 }}/>
              <h1 style={{ fontWeight: 700, fontSize: 17, color: '#111827', letterSpacing: '-0.3px' }}>
                Assignments
              </h1>
            </div>
            <p style={{ fontSize: 12.5, color: '#9CA3AF', paddingLeft: 16 }}>
              Manage and create assignments for your classes.
            </p>
          </div>

          {/* Filter + Search bar */}
          <div style={{
            background: '#fff',
            borderBottom: '1px solid #E5E7EB',
            padding: '10px 24px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {/* Filter dropdown */}
            <div style={{ position: 'relative' }}>
              <button style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px',
                background: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                fontSize: 13, color: '#374151',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 13 13">
                  <path d="M2 3h9M4 6.5h5M5.5 10h2" stroke="#6B7280" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Filter By
              </button>
            </div>

            {/* Search */}
            <div style={{ flex: 1, maxWidth: 360, position: 'relative' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 14 14" style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              }}>
                <circle cx="6" cy="6" r="4.5" stroke="#9CA3AF" strokeWidth="1.3"/>
                <path d="M10 10l2.5 2.5" stroke="#9CA3AF" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search Assignment"
                style={{
                  width: '100%',
                  padding: '7px 12px 7px 32px',
                  border: '1px solid #E5E7EB',
                  borderRadius: 8,
                  fontSize: 13, color: '#374151',
                  fontFamily: 'inherit',
                  background: '#FAFAFA',
                }}
              />
            </div>

            {/* Filter tabs */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {(['all', 'completed', 'processing', 'pending'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: filter === f ? 'none' : '1px solid #E5E7EB',
                  background: filter === f ? '#111827' : '#fff',
                  color: filter === f ? '#fff' : '#6B7280',
                  fontSize: 12, fontWeight: filter === f ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'inherit',
                  textTransform: 'capitalize',
                }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Cards grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 100px' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>
                <p style={{ fontSize: 14 }}>No assignments match your search.</p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 14,
              }}>
                {filtered.map(a => (
                  <AssignmentCard
                    key={a._id}
                    a={a}
                    onDelete={handleDelete}
                    onView={id => router.push(`/assignments/${id}/result`)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Floating create button */}
          <div style={{
            position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            zIndex: 40,
          }}>
            <button
              onClick={() => router.push('/assignments/create')}
              style={{
                background: '#111827', color: '#fff',
                border: 'none', borderRadius: 30,
                padding: '12px 26px',
                fontSize: 13.5, fontWeight: 600,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 6px 24px rgba(0,0,0,0.28)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}
            >
              <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                <path d="M6 1.5v9M1.5 6h9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Create Assignment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
