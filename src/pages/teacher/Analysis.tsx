import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';
import { Check, X, Eye, AlertCircle, CheckCircle, Brain, Activity, Smile, UserCheck, Target } from 'lucide-react';
import Markdown from 'react-markdown';

export default function TeacherAnalysis() {
  const { token } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [scoreInput, setScoreInput] = useState('');

  useEffect(() => {
    fetch('/api/submissions/teacher', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(setSubmissions);
  }, [token]);

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
      setSubmissions(submissions.map((s: any) => s.id === id ? { ...s, status: 'approved', score: scoreInput } : s));
      setSelectedSub(null);
      setScoreInput('');
    }
  };

  return (
    <div className="space-y-8 transition-colors duration-300">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Results & Analysis</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Review student submissions and approve grades.</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-glow dark:shadow-none transition-all">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Student</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Exam</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Score</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {submissions.map((sub: any) => (
              <tr key={sub.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold text-xs shadow-glow">
                      {sub.student_name[0]}
                    </div>
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">{sub.student_name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">{sub.exam_title}</td>
                <td className="px-6 py-4">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                    sub.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {sub.status}
                  </span>
                </td>
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
            ))}
          </tbody>
        </table>
      </div>

      {selectedSub && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 shadow-glow-lg"
          >
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{selectedSub.student_name}'s Submission</h2>
                <p className="text-zinc-500 dark:text-zinc-400">{selectedSub.exam_title}</p>
              </div>
              <button onClick={() => setSelectedSub(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Proctoring Recording</h3>
                  {selectedSub.video_url ? (
                    <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg">
                      <video 
                        src={selectedSub.video_url} 
                        controls 
                        className="w-full h-full"
                      />
                    </div>
                  ) : (
                    <div className="p-8 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-center">
                      <p className="text-xs text-zinc-500 italic">No recording available.</p>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Proctoring Logs</h3>
                  <div className="space-y-3">
                    {JSON.parse(selectedSub.proctoring_logs || '[]').map((log: any, i: number) => (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-red-500 dark:text-red-400 text-xs shadow-sm">
                          <AlertCircle size={14} />
                          <span>{log.message} at {new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        {log.screenshot && (
                          <div className="ml-6 aspect-video bg-black rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <img src={log.screenshot} className="w-full h-full object-contain" alt="Suspicious Activity" />
                          </div>
                        )}
                      </div>
                    ))}
                    {JSON.parse(selectedSub.proctoring_logs || '[]').length === 0 && (
                      <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-3 shadow-sm">
                        <Check size={14} /> No suspicious activity detected.
                      </div>
                    )}
                  </div>
                </div>

                </div>
                
                {/* Cognitive & Stress Analysis Section */}
                <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
                      <Brain size={20} />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-500 uppercase">AI Cognitive & Stress Report</h3>
                  </div>

                  <div className="space-y-6">
                    {selectedSub.cognitive_logs ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                            <div className="flex items-center gap-2 text-zinc-500 mb-2">
                              <Smile size={14} />
                              <span className="text-[10px] font-bold uppercase">Dominant Emotion</span>
                            </div>
                            <p className="text-lg font-bold text-zinc-900 dark:text-white capitalize">
                              {JSON.parse(selectedSub.cognitive_logs).reduce((acc: any, curr: any) => {
                                acc[curr.emotion] = (acc[curr.emotion] || 0) + 1;
                                return acc;
                              }, {}).calm > (JSON.parse(selectedSub.cognitive_logs).length / 2) ? 'Calm' : 'Highly Stressed'}
                            </p>
                          </div>
                          <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                            <div className="flex items-center gap-2 text-zinc-500 mb-2">
                              <Activity size={14} />
                              <span className="text-[10px] font-bold uppercase">Avg Focus Level</span>
                            </div>
                            <p className="text-lg font-bold text-emerald-500">
                              {Math.round(JSON.parse(selectedSub.cognitive_logs).reduce((acc: number, curr: any) => acc + curr.focusScore, 0) / JSON.parse(selectedSub.cognitive_logs).length)}%
                            </p>
                          </div>
                          <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                            <div className="flex items-center gap-2 text-zinc-500 mb-2">
                              <Target size={14} />
                              <span className="text-[10px] font-bold uppercase">Gaze Stability</span>
                            </div>
                            <p className="text-lg font-bold text-blue-500">
                              {Math.round((JSON.parse(selectedSub.cognitive_logs).filter((l: any) => l.gaze === 'Center').length / JSON.parse(selectedSub.cognitive_logs).length) * 100)}%
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase">Emotion Timeline</p>
                          <div className="flex gap-1 h-2 rounded-full overflow-hidden">
                            {JSON.parse(selectedSub.cognitive_logs).map((log: any, i: number) => (
                              <div 
                                key={i} 
                                title={`${log.emotion} (${log.focusScore}%)`}
                                className={`flex-1 h-full ${
                                  log.emotion === 'calm' ? 'bg-emerald-500' : 
                                  log.emotion === 'stress' ? 'bg-red-500' : 
                                  'bg-amber-500'
                                }`} 
                              />
                            ))}
                          </div>
                          <div className="flex justify-between text-[10px] text-zinc-500">
                            <span>Exam Start</span>
                            <span>End</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="p-8 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-center">
                        <p className="text-xs text-zinc-500 italic">No cognitive data recorded for this session.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Student Answers</h3>
                <div className="space-y-4">
                  {Object.entries(JSON.parse(selectedSub.answers || '{}')).map(([qId, ans]: any, i: number) => (
                    <div key={qId} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                      <p className="text-xs font-bold text-zinc-500 uppercase">Question {i + 1}</p>
                      <div className="text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 p-4 rounded-xl font-mono text-sm whitespace-pre-wrap border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        {typeof ans === 'string' ? ans : (ans.answer || ans.code || 'No answer provided')}
                      </div>
                    </div>
                  ))}
                </div>

                <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Grading Status</h3>
                  <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-zinc-500 uppercase">AI Generated Score</span>
                      <span className="text-2xl font-bold text-emerald-500">
                        {selectedSub.results_released ? `${selectedSub.score}/100` : '--/100'}
                      </span>
                    </div>
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase mb-1">Status</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300">
                        {selectedSub.results_released 
                          ? "Results have been released to the student." 
                          : "This submission has been automatically graded by AI. Results and analysis are locked until you release them in the Assignments tab."}
                      </p>
                    </div>
                  </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
