'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { assignmentsApi } from '@/lib/api';
import { useWebSocket } from '@/lib/useWebSocket';
import { Result, Assignment, Question, Section } from '@/types';
import toast from 'react-hot-toast';

/* Difficulty badge - exact Figma colors */
function Diff({ d }: { d: string }) {
  const map: Record<string, [string, string]> = {
    Easy:     ['#DCFCE7', '#16A34A'],
    Moderate: ['#FEF9C3', '#CA8A04'],
    Hard:     ['#FEE2E2', '#DC2626'],
  };
  const [bg, text] = map[d] || ['#F3F4F6', '#6B7280'];
  return (
    <span style={{
      display: 'inline-block',
      background: bg, color: text,
      fontSize: 11, fontWeight: 600,
      borderRadius: 20, padding: '2px 9px',
      whiteSpace: 'nowrap',
    }}>{d}</span>
  );
}

/* Processing screen */
function Processing({ status }: { status: string }) {
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const t = setInterval(() => {
      setProgress(p => {
        if (p >= 90) return p;
        return p + Math.random() * 8;
      });
    }, 1200);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 40, textAlign: 'center',
    }}>
      <div style={{
        width: 88, height: 88, borderRadius: '50%',
        background: 'linear-gradient(135deg, #FFF7F5, #FFE8E0)',
        border: '2px solid #FDBA9E',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24,
      }}>
        <div className="spin" style={{
          width: 44, height: 44,
          border: '4px solid #FDD5C4',
          borderTop: '4px solid #E8450A',
          borderRadius: '50%',
        }}/>
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8, letterSpacing: '-0.4px' }}>
        Generating Question Paper...
      </h2>
      <p style={{ fontSize: 13.5, color: '#6B7280', marginBottom: 28, maxWidth: 340, lineHeight: 1.6 }}>
        AI is crafting personalized questions based on your specifications. Usually takes 30–60 seconds.
      </p>

      {/* Progress bar */}
      <div style={{ width: 340, background: '#F3F4F6', borderRadius: 10, height: 8, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{
          height: '100%', borderRadius: 10,
          background: 'linear-gradient(90deg, #E8450A, #FF6B2C)',
          width: `${Math.min(progress, 90)}%`,
          transition: 'width 0.8s ease',
        }}/>
      </div>
      <p style={{ fontSize: 12, color: '#9CA3AF' }}>
        {status === 'processing' ? 'Writing questions...' : 'Preparing...'}
      </p>
    </div>
  );
}

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [status, setStatus] = useState('pending');
  const [regenerating, setRegenerating] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    try {
      const [ar, rr] = await Promise.all([
        assignmentsApi.getById(id),
        assignmentsApi.getResult(id),
      ]);
      setAssignment(ar.data.data);
      setStatus(rr.data.status || ar.data.data.status);
      if (rr.data.data) setResult(rr.data.data);
    } catch {
      // Demo mode
      setStatus('completed');
      setMockData();
    }
  }, [id]);

  const setMockData = () => {
    setAssignment({
      _id: id, title: 'Quiz on Electricity', subject: 'Science', grade: '8th',
      dueDate: '2025-06-21', questionTypes: [], totalQuestions: 10, totalMarks: 20,
      schoolName: 'Delhi Public School, Sector-4, Bokaro', status: 'completed',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    setResult({
      _id: 'demo', assignmentId: id,
      questionPaper: {
        schoolName: 'Delhi Public School, Sector-4, Bokaro',
        subject: 'Science', grade: 'Class: 8th',
        timeAllowed: '45 minutes', maximumMarks: 20,
        sections: [{
          id: 'a', title: 'Section A',
          instruction: 'Attempt all questions. Each question carries 2 marks',
          totalMarks: 20,
          questions: [
            { id: 'q1', text: 'Define electroplating. Explain its purpose.', difficulty: 'Easy', marks: 2, type: 'Short', answer: 'Electroplating deposits a thin metal layer using electric current to prevent corrosion or improve appearance.' },
            { id: 'q2', text: 'What is the role of a conductor in the process of electrolysis?', difficulty: 'Moderate', marks: 2, type: 'Short', answer: 'A conductor allows electric current flow, enabling ions in the electrolyte to move and chemical changes at electrodes.' },
            { id: 'q3', text: 'Why does a solution of copper sulfate conduct electricity?', difficulty: 'Easy', marks: 2, type: 'Short', answer: 'Copper sulfate has free copper and sulfate ions that carry electric charge, enabling conductivity.' },
            { id: 'q4', text: 'Describe one example of the chemical effect of electric current in daily life.', difficulty: 'Moderate', marks: 2, type: 'Short', answer: 'An example is electroplating silver on jewelry to prevent tarnishing.' },
            { id: 'q5', text: 'Explain why electric current is said to have chemical effects.', difficulty: 'Moderate', marks: 2, type: 'Short', answer: 'Electric current causes ion movement leading to chemical changes at electrodes.' },
            { id: 'q6', text: 'How is sodium hydroxide prepared during the electrolysis of brine? Write the chemical reaction involved.', difficulty: 'Hard', marks: 2, type: 'Short', answer: 'NaOH forms at cathode during brine electrolysis. 2H₂O + 2e⁻ → H₂ + 2OH⁻; Na⁺ + OH⁻ → NaOH' },
            { id: 'q7', text: 'What happens at the cathode and anode during the electrolysis of water? Name the gases evolved.', difficulty: 'Hard', marks: 2, type: 'Short', answer: 'Cathode: water → hydrogen gas + OH⁻. Anode: water → oxygen gas + H⁺.' },
            { id: 'q8', text: 'Mention the type of current used in electroplating and justify why it is used.', difficulty: 'Easy', marks: 2, type: 'Short', answer: 'Direct current (DC) is used as it produces consistent electron flow for controlled deposition.' },
            { id: 'q9', text: 'What is the importance of electric current in the field of metallurgy?', difficulty: 'Moderate', marks: 2, type: 'Short', answer: 'Electric current helps extract metals from ores and purify metals through electrolysis.' },
            { id: 'q10', text: 'Explain with a chemical equation how copper is deposited during the electroplating of an object.', difficulty: 'Hard', marks: 2, type: 'Short', answer: 'Cu²⁺ + 2e⁻ → Cu (solid). Copper ions gain electrons at cathode and deposit.' },
          ],
        }],
      },
      answerKey: [],
      createdAt: new Date().toISOString(),
    });
  };

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (status === 'pending' || status === 'processing') {
      pollRef.current = setInterval(load, 4000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, load]);

  useWebSocket(id, useCallback((msg: any) => {
    if (msg.type === 'assignment_update' && msg.assignmentId === id) {
      setStatus(msg.status);
      if (msg.status === 'completed') { load(); toast.success('Paper ready!'); }
    }
  }, [id, load]));

  const handleRegenerate = async () => {
    setRegenerating(true);
    setResult(null);
    setStatus('pending');
    try {
      await assignmentsApi.regenerate(id);
      toast.success('Regenerating...');
    } catch {
      toast.error('Failed');
    } finally {
      setRegenerating(false);
    }
  };

  const downloadPDF = () => {
    if (!result) return;
    const qp = result.questionPaper;
    const ansMap = new Map(result.answerKey.map(a => [a.questionId, a.answer]));
    const allQs = qp.sections.flatMap(s => s.questions);

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head><title>${qp.schoolName} - Question Paper</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: 'Times New Roman', serif; font-size: 11.5pt; color: #000; padding: 18mm 20mm; }
.center { text-align: center; }
.school { font-size: 17pt; font-weight: bold; margin-bottom: 4px; }
.meta { font-size: 12pt; margin-bottom: 2px; }
.divider { border-bottom: 2px solid #000; margin: 12px 0; }
.thin-divider { border-bottom: 1px solid #000; margin: 8px 0; }
.row { display: flex; justify-content: space-between; font-size: 11pt; margin: 6px 0; }
.instructions { font-style: italic; margin: 8px 0; font-size: 11pt; }
.fields { margin: 10px 0; display: flex; gap: 32px; }
.field { display: flex; align-items: center; gap: 6px; font-size: 11pt; }
.line { border-bottom: 1px solid #000; width: 150px; display: inline-block; }
.section-title { font-size: 13pt; font-weight: bold; text-align: center; text-decoration: underline; margin: 14px 0 4px; }
.section-inst { font-style: italic; text-align: center; font-size: 10.5pt; color: #333; margin-bottom: 10px; }
.q-type { font-weight: bold; font-size: 11pt; margin: 10px 0 4px; }
.q-inst { font-style: italic; font-size: 10.5pt; color: #555; margin-bottom: 8px; }
.q { display: flex; gap: 8px; margin-bottom: 8px; line-height: 1.55; }
.q-num { font-weight: bold; min-width: 22px; }
.q-marks { font-size: 10pt; color: #444; }
.answer-section { margin-top: 18px; }
.answer-title { font-size: 13pt; font-weight: bold; margin-bottom: 10px; }
.ans { margin-bottom: 7px; line-height: 1.55; }
@media print { body { padding: 10mm 15mm; } }
</style></head><body>
<div class="center">
  <div class="school">${qp.schoolName}</div>
  <div class="meta">Subject: ${qp.subject}</div>
  <div class="meta">${qp.grade}</div>
</div>
<div class="divider"></div>
<div class="row">
  <span>Time Allowed: ${qp.timeAllowed}</span>
  <span>Maximum Marks: ${qp.maximumMarks}</span>
</div>
<div class="thin-divider"></div>
<p class="instructions">All questions are compulsory unless stated otherwise.</p>
<div class="fields">
  <div class="field">Name: <span class="line"></span></div>
  <div class="field">Roll Number: <span class="line" style="width:110px"></span></div>
  <div class="field">Class: ${qp.grade} Section: <span class="line" style="width:60px"></span></div>
</div>
${qp.sections.map(sec => `
<div class="section-title">${sec.title}</div>
<div class="section-inst">${sec.instruction}</div>
<div class="q-type">Short Answer Questions</div>
<p class="q-inst">Attempt all questions. Each question carries ${sec.questions[0]?.marks} marks</p>
${sec.questions.map((q, i) => `
<div class="q">
  <span class="q-num">${i+1}.</span>
  <div>
    ${q.text.replace(/\[Easy\]|\[Moderate\]|\[Hard\]|\[Challenging\]/g, '').trim()}
    <span class="q-marks"> [${q.marks} Marks]</span>
  </div>
</div>`).join('')}
`).join('')}
<p style="text-align:center; font-weight:bold; margin-top:14px;">End of Question Paper</p>
<div class="answer-section">
  <div class="answer-title">Answer Key:</div>
  ${allQs.map((q, i) => q.answer ? `<div class="ans"><strong>${i+1}.</strong> ${q.answer}</div>` : '').join('')}
</div>
<script>window.onload = () => { window.print(); }</script>
</body></html>`);
    win.document.close();
  };

  if (status === 'pending' || status === 'processing') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Processing status={status} />
      </div>
    );
  }

  if (!result) return null;

  const qp = result.questionPaper;
  const ansMap = new Map<string, string>();
  // Collect answers from questions themselves + answer key
  qp.sections.forEach(s => s.questions.forEach(q => {
    if (q.answer) ansMap.set(q.id, q.answer);
  }));
  result.answerKey.forEach(a => ansMap.set(a.questionId, a.answer));

  const allQs = qp.sections.flatMap(s => s.questions);
  const totalQ = allQs.length;
  const easyC = allQs.filter(q => q.difficulty === 'Easy').length;
  const modC = allQs.filter(q => q.difficulty === 'Moderate').length;
  const hardC = allQs.filter(q => q.difficulty === 'Hard').length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', overflow: 'hidden' }}>

        {/* Toolbar header */}
        <div style={{
          height: 52,
          background: '#fff',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex', alignItems: 'center',
          padding: '0 20px',
          gap: 12,
          flexShrink: 0,
        }}>
          <button
            onClick={() => router.push('/assignments')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              color: '#6B7280', fontSize: 13,
              padding: '4px 8px', borderRadius: 6,
              fontFamily: 'inherit',
            }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
              <path d="M10 13L6 9l4-4" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Create New
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Bell */}
            <button style={{
              background: 'none', border: 'none', cursor: 'pointer',
              position: 'relative', padding: 4,
            }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                <path d="M10 2a6 6 0 0 0-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 0 0-6-6Z" stroke="#6B7280" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 15.5a2 2 0 0 0 4 0" stroke="#6B7280" strokeWidth="1.5"/>
              </svg>
              <span style={{ position: 'absolute', top: 2, right: 2, width: 7, height: 7, background: '#E8450A', borderRadius: '50%', border: '1.5px solid #fff' }}/>
            </button>

            {/* User */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, color: '#fff', fontWeight: 700 }}>J</div>
              <span style={{ fontSize: 13.5, fontWeight: 500, color: '#374151' }}>John Doe</span>
              <svg width="14" height="14" fill="none" viewBox="0 0 14 14"><path d="M4 6l3 3 3-3" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', background: '#F2F2F2' }}>

          {/* AI message banner */}
          <div style={{
            background: '#1F2937', color: '#fff',
            padding: '14px 24px',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 16,
          }}>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, flex: 1 }}>
              <strong>Certainly!</strong> Here are customized Question Paper for your CBSE {qp.grade}{' '}
              {qp.subject} classes on the NCERT chapters:
            </p>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={downloadPDF}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff', borderRadius: 8,
                  padding: '7px 14px', fontSize: 12.5, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.2)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
                  <path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Download as PDF
              </button>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: '#E8450A',
                  border: 'none',
                  color: '#fff', borderRadius: 8,
                  padding: '7px 14px', fontSize: 12.5, fontWeight: 600,
                  cursor: regenerating ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: regenerating ? 0.7 : 1,
                }}
              >
                {regenerating ? (
                  <span className="spin" style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', display: 'inline-block' }}/>
                ) : (
                  <svg width="13" height="13" fill="none" viewBox="0 0 13 13">
                    <path d="M11.5 6.5A5 5 0 1 1 6.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <path d="M8 1.5h3.5V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                Regenerate
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div style={{
            background: '#fff',
            borderBottom: '1px solid #E5E7EB',
            padding: '10px 24px',
            display: 'flex', alignItems: 'center', gap: 20,
          }}>
            <span style={{ fontSize: 12.5, color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}>
              📝 <strong>{totalQ}</strong> Questions
            </span>
            <span style={{ fontSize: 12.5, color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}>
              ⏱ {qp.timeAllowed}
            </span>
            <span style={{ fontSize: 12.5, color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}>
              ✅ <strong>{qp.maximumMarks}</strong> Marks
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {easyC > 0 && <span style={{ fontSize: 11.5, background: '#DCFCE7', color: '#16A34A', borderRadius: 20, padding: '2px 9px', fontWeight: 600 }}>Easy {easyC}</span>}
              {modC > 0 && <span style={{ fontSize: 11.5, background: '#FEF9C3', color: '#CA8A04', borderRadius: 20, padding: '2px 9px', fontWeight: 600 }}>Moderate {modC}</span>}
              {hardC > 0 && <span style={{ fontSize: 11.5, background: '#FEE2E2', color: '#DC2626', borderRadius: 20, padding: '2px 9px', fontWeight: 600 }}>Hard {hardC}</span>}
            </div>
          </div>

          {/* Question Paper */}
          <div style={{ padding: '28px 32px 60px' }}>
            <div className="fade-in" style={{
              background: '#fff',
              border: '1px solid #E5E7EB',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              maxWidth: 860,
              margin: '0 auto',
            }}>
              {/* Paper header */}
              <div style={{
                textAlign: 'center',
                padding: '28px 48px 22px',
                borderBottom: '2px solid #111827',
              }}>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 5, letterSpacing: '-0.3px' }}>
                  {qp.schoolName}
                </h1>
                <p style={{ fontSize: 14, color: '#374151', marginBottom: 2 }}>Subject: {qp.subject}</p>
                <p style={{ fontSize: 13.5, color: '#6B7280' }}>{qp.grade}</p>
              </div>

              {/* Meta */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '12px 48px',
                borderBottom: '1px solid #E5E7EB',
                fontSize: 13, color: '#374151',
              }}>
                <span>Time Allowed: {qp.timeAllowed}</span>
                <span>Maximum Marks: {qp.maximumMarks}</span>
              </div>

              {/* Instructions */}
              <div style={{
                padding: '10px 48px',
                borderBottom: '1px solid #F3F4F6',
                fontSize: 13, color: '#374151',
              }}>
                All questions are compulsory unless stated otherwise.
              </div>

              {/* Student info */}
              <div style={{
                padding: '14px 48px',
                borderBottom: '1px solid #E5E7EB',
                display: 'flex', gap: 24, flexWrap: 'wrap',
              }}>
                {['Name', 'Roll Number', `Class: ${qp.grade} Section`].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151' }}>
                    <span>{f}:</span>
                    <div style={{ width: 130, borderBottom: '1px solid #374151', marginBottom: -1 }}/>
                  </div>
                ))}
              </div>

              {/* Sections */}
              {qp.sections.map((sec, si) => (
                <div key={sec.id} style={{
                  padding: '22px 48px',
                  borderBottom: si < qp.sections.length - 1 ? '1px solid #E5E7EB' : 'none',
                }}>
                  <h2 style={{
                    fontSize: 15, fontWeight: 700,
                    textAlign: 'center', textDecoration: 'underline',
                    marginBottom: 4, color: '#111827',
                  }}>{sec.title}</h2>

                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 3 }}>
                      Short Answer Questions
                    </p>
                    <p style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>
                      {sec.instruction}
                    </p>
                  </div>

                  {sec.questions.map((q, qi) => (
                    <div key={q.id} style={{
                      display: 'flex', gap: 10,
                      padding: '10px 0',
                      borderBottom: qi < sec.questions.length - 1 ? '1px solid #F9FAFB' : 'none',
                    }}>
                      <span style={{ fontSize: 13.5, fontWeight: 500, color: '#374151', minWidth: 24, flexShrink: 0 }}>
                        {qi + 1}.
                      </span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13.5, color: '#111827', lineHeight: 1.65, marginBottom: 6 }}>
                          {/* Remove difficulty tags from text if present */}
                          {q.text.replace(/\[(Easy|Moderate|Hard|Challenging)\]\s*/g, '')}
                          <span style={{ fontSize: 12, color: '#6B7280', marginLeft: 6 }}>
                            [{q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}]
                          </span>
                        </p>
                        <Diff d={q.difficulty} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* End of paper */}
              <div style={{
                textAlign: 'center',
                padding: '14px',
                borderTop: '1px solid #E5E7EB',
                fontSize: 13, fontWeight: 700, color: '#374151',
              }}>
                End of Question Paper
              </div>

              {/* Answer Key toggle */}
              <div style={{ borderTop: '1px solid #E5E7EB' }}>
                <button
                  onClick={() => setShowAnswers(a => !a)}
                  style={{
                    width: '100%',
                    padding: '14px 48px',
                    background: '#F9FAFB',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: 13.5, fontWeight: 700, color: '#111827',
                    fontFamily: 'inherit',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#F9FAFB'}
                >
                  <span>Answer Key:</span>
                  <svg
                    width="16" height="16" fill="none" viewBox="0 0 16 16"
                    style={{ transform: showAnswers ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
                  >
                    <path d="M4 6l4 4 4-4" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {showAnswers && (
                  <div className="fade-in" style={{ padding: '0 48px 24px' }}>
                    {allQs.map((q, i) => {
                      const ans = ansMap.get(q.id);
                      return ans ? (
                        <div key={q.id} style={{
                          padding: '10px 0',
                          borderBottom: i < allQs.length - 1 ? '1px solid #F3F4F6' : 'none',
                          fontSize: 13, lineHeight: 1.65, color: '#374151',
                        }}>
                          <strong>{i + 1}.</strong> {ans}
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
