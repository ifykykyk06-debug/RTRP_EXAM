import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';
import { BarChart3, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function StudentResults() {
  const { token } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);

  useEffect(() => {
    fetch('/api/submissions/student', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setSubmissions(data.filter((s: any) => s.results_released)));
  }, [token]);

  return (
    <div className="space-y-8 transition-colors duration-300">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Examination Results</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">View your scores and feedback from teachers.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {submissions.map((sub: any) => (
          <motion.div 
            key={sub.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-glow dark:shadow-none transition-all"
          >
            <div className="flex items-center gap-6">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border-2 shadow-sm ${
                sub.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
              }`}>
                <BarChart3 size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{sub.exam_title}</h3>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <Clock size={14} /> Submitted {new Date(sub.submitted_at).toLocaleDateString()}
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${
                    sub.status === 'approved' ? 'text-emerald-500' : 'text-amber-500'
                  }`}>
                    {sub.status === 'approved' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    {sub.status}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8 w-full md:w-auto border-t md:border-t-0 border-zinc-200 dark:border-zinc-800 pt-6 md:pt-0">
              <div className="text-center">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Score</div>
                <div className="text-3xl font-bold text-zinc-900 dark:text-white">
                  {sub.results_released ? (sub.score ?? '0') : '--'}
                  <span className="text-zinc-400 dark:text-zinc-600 text-lg">/100</span>
                </div>
              </div>
              <button 
                disabled={!sub.results_released}
                onClick={() => setSelectedSubmission(sub)}
                className="flex-1 md:flex-none bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-900 dark:text-white px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {sub.results_released ? 'View Detailed Report' : 'Results Pending'}
              </button>
            </div>
          </motion.div>
        ))}
        {submissions.length === 0 && (
          <div className="text-center py-20 bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 border-dashed rounded-3xl shadow-sm">
            <p className="text-zinc-500">You haven't taken any exams yet.</p>
          </div>
        )}
      </div>

      {selectedSubmission && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-glow-lg"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{selectedSubmission.exam_title} - Detailed Report</h2>
              <button onClick={() => setSelectedSubmission(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">Close</button>
            </div>
            
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shadow-glow">
              <p className="text-emerald-500 font-bold text-center text-2xl">Final Score: {selectedSubmission.score}/100</p>
            </div>

            {selectedSubmission.ai_analysis && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-2 shadow-glow">
                <h3 className="text-sm font-bold text-blue-500 uppercase tracking-wider">AI Proctoring Analysis</h3>
                <p className="text-zinc-600 dark:text-zinc-300 text-sm italic">"{selectedSubmission.ai_analysis}"</p>
                {selectedSubmission.proctoring_logs && JSON.parse(selectedSubmission.proctoring_logs || '[]').length > 0 && (
                  <div className="mt-2 pt-2 border-t border-blue-500/20">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Anomalies Detected</p>
                    <ul className="list-disc list-inside text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                      {JSON.parse(selectedSubmission.proctoring_logs || '[]').map((log: any, idx: number) => (
                        <li key={idx}>{log.message} ({new Date(log.timestamp).toLocaleTimeString()})</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Your Submissions</h3>
              {Object.entries(JSON.parse(selectedSubmission.answers || '{}')).map(([qId, ans]: any, i: number) => (
                <div key={qId} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <p className="text-sm text-zinc-500">Question {i + 1}</p>
                  <div className="text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 p-3 rounded-lg font-mono text-sm whitespace-pre-wrap border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    {typeof ans === 'string' ? ans : (ans.answer || ans.code || 'No answer provided')}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
