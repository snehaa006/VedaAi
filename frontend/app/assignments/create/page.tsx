'use client';
import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { assignmentsApi } from '@/lib/api';
import { useAssignmentStore } from '@/store/assignmentStore';
import { useWebSocket } from '@/lib/useWebSocket';
import toast from 'react-hot-toast';

const QTYPES = [
  'Multiple Choice Questions',
  'Short Questions',
  'Long Questions',
  'Diagram/Graph-Based Questions',
  'Numerical Problems',
  'Fill in the Blanks',
  'True/False',
  'Match the Following',
  'Case Study Questions',
  'Essay Questions',
];

interface QRow { id: string; type: string; count: number; marks: number; }
interface UploadedFilePayload { name: string; mimeType: string; data: string; }

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1px solid #E5E7EB', borderRadius: 7,
  fontSize: 13, color: '#111827', background: '#fff',
  fontFamily: 'Inter, sans-serif',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

function StepDots({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 0 }}>
      {[0, 1].map(i => (
        <div key={i} style={{
          height: 3, flex: 1,
          borderRadius: 2,
          background: i <= current - 1 ? '#E8450A' : '#E5E7EB',
          transition: 'background 0.3s',
        }}/>
      ))}
    </div>
  );
}

export default function CreatePage() {
  const router = useRouter();
  const { addAssignment, updateAssignment } = useAssignmentStore();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Fields
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState<UploadedFilePayload | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [instructions, setInstructions] = useState('');
  const [rows, setRows] = useState<QRow[]>([
    { id: '1', type: 'Multiple Choice Questions', count: 4, marks: 1 },
    { id: '2', type: 'Short Questions', count: 3, marks: 2 },
    { id: '3', type: 'Diagram/Graph-Based Questions', count: 5, marks: 5 },
    { id: '4', type: 'Numerical Problems', count: 5, marks: 5 },
  ]);

  const totalQ = rows.reduce((s, r) => s + r.count, 0);
  const totalM = rows.reduce((s, r) => s + r.count * r.marks, 0);

  const handleWS = useCallback((msg: any) => {
    if (msg.type === 'assignment_update' && msg.assignmentId === createdId) {
      updateAssignment(msg.assignmentId, { status: msg.status });
      if (msg.status === 'completed') {
        toast.success('Question paper ready!');
        router.push(`/assignments/${msg.assignmentId}/result`);
      } else if (msg.status === 'failed') {
        toast.error('Generation failed. Please try again.');
        setSubmitting(false);
      }
    }
  }, [createdId, updateAssignment, router]);

  useWebSocket(createdId, handleWS);

  const pickFile = (f: File) => {
    if (f.size > MAX_UPLOAD_SIZE) {
      toast.error('File must be 10MB or smaller');
      return;
    }

    setFile(f);
    setFileContent('');
    setUploadedFile(null);

    if (f.type === 'text/plain') {
      const r = new FileReader();
      r.onload = e => setFileContent(e.target?.result as string || '');
      r.readAsText(f);
      return;
    }

    if (f.type.startsWith('image/')) {
      const r = new FileReader();
      r.onload = e => {
        const result = e.target?.result;
        if (typeof result !== 'string') return;
        const data = result.split(',')[1] || '';
        setUploadedFile({ name: f.name, mimeType: f.type, data });
      };
      r.readAsDataURL(f);
    }
  };

  const upd = (id: string, k: keyof QRow, v: any) =>
    setRows(rs => rs.map(r => r.id === id ? { ...r, [k]: v } : r));

  const validate1 = () => {
    if (!title.trim()) { toast.error('Enter assignment title'); return false; }
    if (!subject.trim()) { toast.error('Enter subject'); return false; }
    if (!grade.trim()) { toast.error('Enter grade/class'); return false; }
    if (!dueDate) { toast.error('Select due date'); return false; }
    return true;
  };

  const validate2 = () => {
    if (!rows.length) { toast.error('Add at least one question type'); return false; }
    for (const r of rows) {
      if (r.count < 1) { toast.error('Questions must be ≥ 1'); return false; }
      if (r.marks < 1) { toast.error('Marks must be ≥ 1'); return false; }
    }
    return true;
  };

  const submit = async () => {
    if (!validate2()) return;
    setSubmitting(true);
    try {
      const res = await assignmentsApi.create({
        title, subject, grade, dueDate,
        questionTypes: rows.map(r => ({ type: r.type, count: r.count, marks: r.marks })),
        additionalInstructions: instructions,
        uploadedFileContent: fileContent,
        uploadedFile,
        schoolName: 'Delhi Public School',
      });
      const a = res.data.data;
      addAssignment(a);
      setCreatedId(a._id);
      toast.success('Generating question paper...');

      // Poll fallback
      let polls = 0;
      const poll = setInterval(async () => {
        polls++;
        try {
          const r = await assignmentsApi.getResult(a._id);
          if (r.data.status === 'completed') {
            clearInterval(poll);
            router.push(`/assignments/${a._id}/result`);
          }
        } catch {}
        if (polls > 30) clearInterval(poll);
      }, 3000);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to create');
      setSubmitting(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #E5E7EB',
    borderRadius: 12,
    padding: '22px 24px',
    marginBottom: 14,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: '#F2F2F2' }}>
      <Header title="Assignment" showBack />

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>

          {/* Page title */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }}/>
              <h1 style={{ fontWeight: 700, fontSize: 17, color: '#111827', letterSpacing: '-0.3px' }}>
                Create Assignment
              </h1>
            </div>
            <p style={{ fontSize: 12.5, color: '#9CA3AF', marginLeft: 16 }}>Set up a new assignment for your students</p>
            <div style={{ marginTop: 14 }}>
              <StepDots current={step} />
            </div>
          </div>

          {step === 1 ? (
            <div className="fade-in">
              {/* Assignment Details card */}
              <div style={cardStyle}>
                <h2 style={{ fontWeight: 600, fontSize: 15, color: '#111827', marginBottom: 3 }}>
                  Assignment Details
                </h2>
                <p style={{ fontSize: 12.5, color: '#9CA3AF', marginBottom: 18 }}>
                  Basic information about your assignment
                </p>

                {/* Drop zone */}
                <div
                  onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) pickFile(e.dataTransfer.files[0]); }}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  style={{
                    border: `2px dashed ${dragging ? '#E8450A' : '#D1D5DB'}`,
                    borderRadius: 10,
                    padding: '28px 20px',
                    textAlign: 'center',
                    background: dragging ? '#FFF7F5' : '#FAFAFA',
                    transition: 'all 0.2s',
                    marginBottom: 6,
                    cursor: 'pointer',
                  }}
                  onClick={() => document.getElementById('fileInput')?.click()}
                >
                  {file ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <div style={{
                        background: '#E8450A', color: '#fff',
                        borderRadius: 5, padding: '3px 8px',
                        fontSize: 11, fontWeight: 700,
                      }}>
                        {file.name.split('.').pop()?.toUpperCase() || 'FILE'}
                      </div>
                      <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{file.name}</span>
                      <button
                        onClick={e => { e.stopPropagation(); setFile(null); setFileContent(''); setUploadedFile(null); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 16, lineHeight: 1 }}
                      >×</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 10 }}>
                        <svg width="28" height="28" fill="none" viewBox="0 0 28 28" style={{ margin: '0 auto', display: 'block' }}>
                          <path d="M14 5v12M10 9l4-4 4 4" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M5 20h18" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round"/>
                          <path d="M5 20v4h18v-4" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 10, lineHeight: 1.5 }}>
                        Choose a file or drag & drop it here<br/>
                        <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>JPEG, PNG, GIF, PDF up to 10MB</span>
                      </p>
                      <button
                        onClick={e => { e.stopPropagation(); document.getElementById('fileInput')?.click(); }}
                        style={{
                          padding: '7px 18px',
                          border: '1px solid #D1D5DB',
                          borderRadius: 7,
                          background: '#fff',
                          fontSize: 13, fontWeight: 500,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >Browse Files</button>
                    </>
                  )}
                  <input id="fileInput" type="file" accept=".pdf,.txt,.png,.jpg,.jpeg,.gif,.webp" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files?.[0]) pickFile(e.target.files[0]); }} />
                </div>
                <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 20 }}>
                  Upload Images of your preferred document/image
                </p>

                {/* Due Date */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                    Due Date
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="date" value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      placeholder="DD-MM-YYYY"
                      min={new Date().toISOString().split('T')[0]}
                      style={{ ...inp, paddingRight: 36 }}
                    />
                    <svg width="15" height="15" fill="none" viewBox="0 0 15 15" style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                    }}>
                      <rect x="1.5" y="2.5" width="12" height="11" rx="2" stroke="#9CA3AF" strokeWidth="1.3"/>
                      <path d="M5 1.5v2M10 1.5v2M1.5 6h12" stroke="#9CA3AF" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>

                {/* Title + Subject + Grade in a grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12.5, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Assignment Title *
                    </label>
                    <input value={title} onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Quiz on Electricity" style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Subject *
                    </label>
                    <input value={subject} onChange={e => setSubject(e.target.value)}
                      placeholder="e.g. Science" style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Grade / Class *
                    </label>
                    <input value={grade} onChange={e => setGrade(e.target.value)}
                      placeholder="e.g. Grade 8" style={inp} />
                  </div>
                </div>
              </div>

              {/* Nav */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <button
                  onClick={() => router.back()}
                  style={{ ...navBtn, background: '#fff', border: '1px solid #E5E7EB', color: '#374151' }}
                >
                  ← Previous
                </button>
                <button
                  onClick={() => { if (validate1()) setStep(2); }}
                  style={{ ...navBtn, background: '#111827', color: '#fff' }}
                >
                  Next →
                </button>
              </div>
            </div>
          ) : (
            <div className="fade-in">
              {/* Question Types card */}
              <div style={cardStyle}>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 140px 100px 32px',
                  gap: 8,
                  marginBottom: 10,
                  fontSize: 11.5,
                  color: '#6B7280',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}>
                  <span>Question Type</span>
                  <span style={{ textAlign: 'center' }}>No. of Questions</span>
                  <span style={{ textAlign: 'center' }}>Marks</span>
                  <span/>
                </div>

                {rows.map(r => (
                  <div key={r.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 140px 100px 32px',
                    gap: 8,
                    marginBottom: 8,
                    alignItems: 'center',
                  }}>
                    {/* Type select */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <select
                        value={r.type}
                        onChange={e => upd(r.id, 'type', e.target.value)}
                        style={{ ...inp, flex: 1, padding: '8px 10px', cursor: 'pointer' }}
                      >
                        {QTYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                      <button
                        onClick={() => setRows(rs => rs.filter(x => x.id !== r.id))}
                        style={{
                          background: 'none', border: '1px solid #E5E7EB',
                          borderRadius: 6, width: 26, height: 26,
                          cursor: 'pointer', color: '#9CA3AF',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >×</button>
                    </div>

                    {/* Count stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <button onClick={() => upd(r.id, 'count', Math.max(1, r.count - 1))} style={stepBtn}>−</button>
                      <input
                        type="number" value={r.count} min={1}
                        onChange={e => upd(r.id, 'count', Math.max(1, +e.target.value || 1))}
                        style={{ ...inp, width: 44, padding: '7px 4px', textAlign: 'center', fontSize: 13 }}
                      />
                      <button onClick={() => upd(r.id, 'count', r.count + 1)} style={stepBtn}>+</button>
                    </div>

                    {/* Marks stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <button onClick={() => upd(r.id, 'marks', Math.max(1, r.marks - 1))} style={stepBtn}>−</button>
                      <input
                        type="number" value={r.marks} min={1}
                        onChange={e => upd(r.id, 'marks', Math.max(1, +e.target.value || 1))}
                        style={{ ...inp, width: 44, padding: '7px 4px', textAlign: 'center', fontSize: 13 }}
                      />
                      <button onClick={() => upd(r.id, 'marks', r.marks + 1)} style={stepBtn}>+</button>
                    </div>

                    <div/>
                  </div>
                ))}

                {/* Add Question Type */}
                <button
                  onClick={() => setRows(rs => [...rs, { id: Date.now().toString(), type: 'Short Questions', count: 5, marks: 5 }])}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#374151', fontSize: 13, fontWeight: 500,
                    padding: '8px 0',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: '#111827',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M5 1.5v7M1.5 5h7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  Add Question Type
                </button>

                {/* Totals */}
                <div style={{
                  borderTop: '1px solid #E5E7EB', marginTop: 12, paddingTop: 12,
                  display: 'flex', justifyContent: 'flex-end', gap: 24,
                  fontSize: 13, fontWeight: 600, color: '#374151',
                }}>
                  <span>Total Questions : {totalQ}</span>
                  <span>Total Marks : {totalM}</span>
                </div>
              </div>

              {/* Additional info */}
              <div style={cardStyle}>
                <label style={{ fontSize: 12.5, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Additional Information (For better output)
                </label>
                <div style={{ position: 'relative' }}>
                  <textarea
                    value={instructions}
                    onChange={e => setInstructions(e.target.value)}
                    placeholder="e.g. Generate a question paper for 1 hour exam duration..."
                    rows={3}
                    style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                  />
                  <svg width="14" height="14" fill="none" viewBox="0 0 14 14" style={{
                    position: 'absolute', right: 10, bottom: 10,
                    color: '#D1D5DB',
                  }}>
                    <path d="M12 12L4 12L12 4" stroke="#D1D5DB" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>

              {/* Nav */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <button onClick={() => setStep(1)} style={{ ...navBtn, background: '#fff', border: '1px solid #E5E7EB', color: '#374151' }}>
                  ← Previous
                </button>
                <button
                  onClick={submit} disabled={submitting}
                  style={{ ...navBtn, background: submitting ? '#9CA3AF' : '#111827', color: '#fff', gap: 8, minWidth: 120 }}
                >
                  {submitting ? (
                    <><span className="spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', display: 'inline-block' }}/> Generating...</>
                  ) : 'Next →'}
                </button>
              </div>

              {/* Processing banner */}
              {submitting && (
                <div className="fade-in" style={{
                  marginTop: 14,
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: 10,
                  padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div className="spin" style={{
                    width: 20, height: 20,
                    border: '2.5px solid #D1FAE5',
                    borderTop: '2.5px solid #22C55E',
                    borderRadius: '50%',
                    flexShrink: 0,
                  }}/>
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: '#15803D' }}>AI is generating your question paper</p>
                    <p style={{ fontSize: 12, color: '#16A34A', marginTop: 2 }}>
                      This takes 30–60 seconds. You'll be redirected automatically.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  padding: '9px 22px',
  borderRadius: 8, border: 'none',
  fontSize: 13.5, fontWeight: 600,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 6,
  fontFamily: 'inherit',
  transition: 'all 0.15s',
};

const stepBtn: React.CSSProperties = {
  width: 26, height: 26,
  border: '1px solid #E5E7EB',
  borderRadius: 6, background: '#F9FAFB',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 14, color: '#374151',
  flexShrink: 0,
  fontFamily: 'inherit',
};
