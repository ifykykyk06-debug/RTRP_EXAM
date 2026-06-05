import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check, X, Eye, AlertCircle, CheckCircle, Brain, Activity,
  Smile, UserCheck, Target, AlertTriangle, ShieldOff, ShieldCheck,
  Camera, RotateCcw
} from 'lucide-react';
import Markdown from 'react-markdown';

type Submission = {
  id: number;
  student_name: string;
  exam_title: string;
  status: string;
  score: number | null;
  results_released: number;
  proctoring_logs: string;
  cognitive_logs: string;
  ai_analysis: string;
  cognitive_analysis: string;
  focus_analysis: string;
  growth_analysis: string;
  detailed_feedback: string;
  video_url: string;
  answers: string;
  auto_submitted: number;
  grade: string;
  face_mismatch_logs: string;
  violation_count: number;
};

export default function TeacherAnalysis() {
  const { token } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [scoreInput, setScoreInput] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'malpractice'>('all');
  const [overrideLoading, setOverrideLoading] = useState(false);

  useEffect(() => {
    fetch('/api/submissions/teacher', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setSubmissions);
  }, [token]);

  const malpracticeSubmissions = submissions.filter(s => s.auto_submitted === 1);
  const faceMismatchSubmissions = submissions.filter(s => {
    try { return JSON.parse(s.face_mismatch_logs || '[]').length > 0; } catch { return false; }
  });

  const handleApprove = async (id: number) => {
    const res = await fetch(`/api/submissions/${id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ score: parseFloat(scoreInput) })
    });
    if (res.ok) {
      setSubmissions(submissions.map((s: any) =>
        s.id === id ? { ...s, status: 'approved', score: scoreInput } : s
      ));
      setSelectedSub(null);
      setScoreInput('');
    }
  };

  const handleOverrideGrade = async (id: number, newGrade: 'PASS' | 'FAIL') => {
    setOverrideLoading(true);
    const res = await fetch(`/api/submissions/${id}/override-grade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ grade: newGrade })
    });
    if (res.ok) {
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, grade: newGrade } : s));
      if (selectedSub?.id === id) setSelectedSub(prev => prev ? { ...prev, grade: newGrade } : null);
    }
    setOverrideLoading(false);
  };

  const getGradeBadge = (sub: Submission) => {
    if (sub.grade === 'FAIL') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-red-500/15 text-red-500 border border-red-500/20">
          <ShieldOff size={10} /> FAIL {sub.auto_submitted ? '(Auto)' : ''}
        </span>
      );
    }
    if (sub.grade === 'PASS') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
          <ShieldCheck size={10} /> PASS (Override)
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/10 text-amber-500">
        PENDING
      </span>
    );
  };

  const displayList = activeTab === 'malpractice' ? malpracticeSubmissions : submissions;

  return (
    <div className="space-y-8 transition-colors duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Results & Analysis</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Review student submissions, violations, and approve grades.</p>
        </div>

        {/* Stats */}
        <div className="flex gap-3">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-center min-w-[80px]">
            <p className="text-2xl font-black text-zinc-900 dark:text-white">{submissions.length}</p>
            <p className="text-[10px] text-zinc-500 uppercase font-bold">Total</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-red-500/20 rounded-2xl px-4 py-3 text-center min-w-[80px]">
            <p className="text-2xl font-black text-red-500">{malpracticeSubmissions.length}</p>
            <p className="text-[10px] text-zinc-500 uppercase font-bold">Malpractice</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-amber-500/20 rounded-2xl px-4 py-3 text-center min-w-[80px]">
            <p className="text-2xl font-black text-amber-500">{faceMismatchSubmissions.length}</p>
            <p className="text-[10px] text-zinc-500 uppercase font-bold">Face ⚠️</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 w-fit">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'all' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
        >
          All Submissions ({submissions.length})
        </button>
        <button
          onClick={() => setActiveTab('malpractice')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'malpractice' ? 'bg-red-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
        >
          <AlertTriangle size={14} />
          Malpractice ({malpracticeSubmissions.length})
        </button>
      </div>

      {/* Malpractice Banner */}
      {activeTab === 'malpractice' && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3"
        >
          <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-600 dark:text-red-400 font-bold text-sm">Malpractice Auto-Submitted Exams</p>
            <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1">
              These students exceeded 5 violations during the exam and were automatically graded FAIL. Click any row to view their violation screenshots and override the grade if needed.
            </p>
          </div>
        </motion.div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-glow dark:shadow-none transition-all">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Student</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Exam</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Violations</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Grade</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Score</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {displayList.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 text-sm italic">
                  {activeTab === 'malpractice' ? 'No malpractice submissions found.' : 'No submissions yet.'}
                </td>
              </tr>
            )}
            {displayList.map((sub) => {
              const faceMismatches = (() => { try { return JSON.parse(sub.face_mismatch_logs || '[]'); } catch { return []; } })();
              return (
                <tr
                  key={sub.id}
                  className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${sub.auto_submitted ? 'bg-red-500/3' : ''}`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${sub.auto_submitted ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        {sub.student_name?.[0] ?? '?'}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-zinc-900 dark:text-white block">{sub.student_name}</span>
                        {faceMismatches.length > 0 && (
                          <span className="text-[10px] text-amber-500 flex items-center gap-1">
                            <AlertTriangle size={9} /> {faceMismatches.length} face mismatch{faceMismatches.length > 1 ? 'es' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">{sub.exam_title}</td>
                  <td className="px-6 py-4">
                    {(sub.violation_count ?? 0) > 0 ? (
                      <span className={`text-sm font-bold ${sub.violation_count >= 5 ? 'text-red-500' : sub.violation_count >= 3 ? 'text-amber-500' : 'text-zinc-400'}`}>
                        {sub.violation_count} / 5
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600 italic">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4">{getGradeBadge(sub)}</td>
                  <td className="px-6 py-4 text-sm font-bold text-zinc-900 dark:text-white">
                    {sub.results_released ? (sub.score ?? '-') : '--'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedSub(sub)}
                      className="text-zinc-400 hover:text-emerald-500 transition-colors"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {selectedSub && (
          <div className="fixed inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-y-auto p-8 shadow-2xl"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{selectedSub.student_name}'s Submission</h2>
                  <p className="text-zinc-500 dark:text-zinc-400">{selectedSub.exam_title}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {getGradeBadge(selectedSub)}
                    {selectedSub.auto_submitted === 1 && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                        🚨 Auto-Submitted (Malpractice)
                      </span>
                    )}
                    {selectedSub.violation_count > 0 && (
                      <span className="text-[10px] text-zinc-500">{selectedSub.violation_count} total violations</span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedSub(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                  <X size={24} />
                </button>
              </div>

              {/* ── Grade Override (for FAIL submissions) ── */}
              {selectedSub.auto_submitted === 1 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-5 bg-red-500/10 border border-red-500/30 rounded-2xl"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-red-500 font-bold text-sm flex items-center gap-2">
                        <ShieldOff size={16} /> Exam Auto-Submitted — Grade: FAIL
                      </p>
                      <p className="text-zinc-500 text-xs mt-1">
                        This student's exam was automatically submitted after {selectedSub.violation_count} violations.
                        Review the evidence below, then override if appropriate.
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {selectedSub.grade !== 'PASS' && (
                        <button
                          onClick={() => handleOverrideGrade(selectedSub.id, 'PASS')}
                          disabled={overrideLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                        >
                          <ShieldCheck size={14} /> Override → PASS
                        </button>
                      )}
                      {selectedSub.grade !== 'FAIL' && (
                        <button
                          onClick={() => handleOverrideGrade(selectedSub.id, 'FAIL')}
                          disabled={overrideLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                        >
                          <RotateCcw size={14} /> Revert → FAIL
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">

                  {/* Proctoring Recording */}
                  <div>
                    <h3 className="text-sm font-bold text-zinc-500 uppercase mb-3">Proctoring Recording</h3>
                    {selectedSub.video_url ? (
                      <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                        <video src={selectedSub.video_url} controls className="w-full h-full" />
                      </div>
                    ) : (
                      <div className="p-8 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-center">
                        <p className="text-xs text-zinc-500 italic">No recording available.</p>
                      </div>
                    )}
                  </div>

                  {/* Violation Screenshots */}
                  <div>
                    <h3 className="text-sm font-bold text-zinc-500 uppercase mb-3 flex items-center gap-2">
                      <AlertCircle size={14} className="text-red-500" />
                      Violation Logs & Evidence
                    </h3>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {JSON.parse(selectedSub.proctoring_logs || '[]').map((log: any, i: number) => (
                        <div key={i} className="space-y-2">
                          <div className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-red-500 dark:text-red-400 text-xs">
                            <AlertCircle size={12} />
                            <span className="font-semibold">{log.message}</span>
                            <span className="text-zinc-500 ml-auto shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          </div>
                          {log.screenshot && (
                            <div className="ml-4 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm">
                              <img src={log.screenshot} className="w-full object-cover" alt={`Violation ${i + 1}`} />
                            </div>
                          )}
                        </div>
                      ))}
                      {JSON.parse(selectedSub.proctoring_logs || '[]').length === 0 && (
                        <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-3">
                          <Check size={14} /> No violations recorded.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Face Mismatch Logs */}
                  {(() => {
                    const mismatches = (() => { try { return JSON.parse(selectedSub.face_mismatch_logs || '[]'); } catch { return []; } })();
                    if (mismatches.length === 0) return null;
                    return (
                      <div>
                        <h3 className="text-sm font-bold text-amber-500 uppercase mb-3 flex items-center gap-2">
                          <Camera size={14} />
                          Face Identity Mismatches ({mismatches.length})
                        </h3>
                        <p className="text-xs text-zinc-500 mb-3">
                          These captures were taken every 30 seconds and did not match the registered face.
                          The student was notified but allowed to continue.
                        </p>
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                          {mismatches.map((m: any, i: number) => (
                            <div key={i} className="space-y-2">
                              <div className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl text-amber-600 text-xs">
                                <AlertTriangle size={12} />
                                <span>Face mismatch detected (distance: {m.distance})</span>
                                <span className="text-zinc-500 ml-auto shrink-0">{new Date(m.timestamp).toLocaleTimeString()}</span>
                              </div>
                              {m.screenshot && (
                                <div className="ml-4 rounded-xl overflow-hidden border border-amber-500/20 shadow-sm">
                                  <img src={m.screenshot} className="w-full object-cover" alt={`Mismatch ${i + 1}`} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Cognitive Analysis */}
                  <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
                        <Brain size={18} />
                      </div>
                      <h3 className="text-sm font-bold text-zinc-500 uppercase">AI Cognitive & Stress Report</h3>
                    </div>
                    {selectedSub.cognitive_logs ? (() => {
                      const logs = (() => { try { return JSON.parse(selectedSub.cognitive_logs); } catch { return []; } })();
                      if (!logs.length) return <p className="text-xs text-zinc-500 italic">No cognitive data.</p>;
                      const avgFocus = Math.round(logs.reduce((a: number, c: any) => a + (c.focusScore || 0), 0) / logs.length);
                      const centreGaze = Math.round((logs.filter((l: any) => l.gaze === 'Center').length / logs.length) * 100);
                      const emotionCounts: any = logs.reduce((acc: any, c: any) => { acc[c.emotion] = (acc[c.emotion] || 0) + 1; return acc; }, {});
                      const dominantEmotion = Object.entries(emotionCounts).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'Unknown';
                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { icon: <Smile size={12} />, label: 'Dominant Emotion', value: dominantEmotion, color: 'text-purple-500' },
                              { icon: <Activity size={12} />, label: 'Avg Focus', value: `${avgFocus}%`, color: 'text-emerald-500' },
                              { icon: <Target size={12} />, label: 'Gaze Stability', value: `${centreGaze}%`, color: 'text-blue-500' },
                            ].map((stat, i) => (
                              <div key={i} className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                                <div className="flex items-center gap-1 text-zinc-500 mb-1">{stat.icon}<span className="text-[10px] font-bold uppercase">{stat.label}</span></div>
                                <p className={`text-base font-bold capitalize ${stat.color}`}>{stat.value}</p>
                              </div>
                            ))}
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Emotion Timeline</p>
                            <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
                              {logs.map((log: any, i: number) => (
                                <div
                                  key={i}
                                  title={`${log.emotion} (${log.focusScore}%)`}
                                  className={`flex-1 h-full ${log.emotion === 'calm' ? 'bg-emerald-500' : log.emotion === 'stress' ? 'bg-red-500' : 'bg-amber-500'}`}
                                />
                              ))}
                            </div>
                            <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                              <span>Start</span><span>End</span>
                            </div>
                          </div>
                        </div>
                      );
                    })() : (
                      <p className="text-xs text-zinc-500 italic">No cognitive data recorded.</p>
                    )}
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Student Answers */}
                  <div>
                    <h3 className="text-sm font-bold text-zinc-500 uppercase mb-3">Student Answers</h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {Object.entries(JSON.parse(selectedSub.answers || '{}')).map(([qId, ans]: any, i: number) => (
                        <div key={qId} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                          <p className="text-xs font-bold text-zinc-500 uppercase">Question {i + 1}</p>
                          <div className="text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 p-3 rounded-xl font-mono text-sm whitespace-pre-wrap border border-zinc-200 dark:border-zinc-800">
                            {typeof ans === 'string' ? ans : (ans.answer || ans.code || 'No answer')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Feedback */}
                  {selectedSub.ai_analysis && (
                    <div>
                      <h3 className="text-sm font-bold text-zinc-500 uppercase mb-3">AI Analysis</h3>
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-700 dark:text-zinc-300">
                        <Markdown>{selectedSub.ai_analysis}</Markdown>
                      </div>
                    </div>
                  )}

                  {/* Grading Panel */}
                  <div>
                    <h3 className="text-sm font-bold text-zinc-500 uppercase mb-3">Grading</h3>
                    <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-zinc-500 uppercase">AI Score</span>
                        <span className="text-2xl font-bold text-emerald-500">
                          {selectedSub.results_released ? `${selectedSub.score ?? 0}/100` : '--/100'}
                        </span>
                      </div>
                      <div className={`p-4 rounded-xl border ${selectedSub.auto_submitted ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
                        <p className={`text-[10px] font-bold uppercase mb-1 ${selectedSub.auto_submitted ? 'text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {selectedSub.auto_submitted ? '⚠️ Malpractice Auto-Submit' : 'Status'}
                        </p>
                        <p className="text-sm text-zinc-600 dark:text-zinc-300">
                          {selectedSub.results_released
                            ? 'Results released to student.'
                            : selectedSub.auto_submitted
                              ? 'Exam was auto-submitted. Grade is FAIL. You can override above.'
                              : 'AI graded. Release results in Assignments tab.'}
                        </p>
                      </div>

                      {/* Manual score override for non-auto-fail */}
                      {!selectedSub.auto_submitted && (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            placeholder="Override score"
                            value={scoreInput}
                            onChange={e => setScoreInput(e.target.value)}
                            className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          />
                          <button
                            onClick={() => handleApprove(selectedSub.id)}
                            disabled={!scoreInput}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                          >
                            <UserCheck size={14} /> Save
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
