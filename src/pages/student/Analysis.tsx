import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';
import { Sparkles, BrainCircuit, Target, TrendingUp, ChevronRight, CheckCircle } from 'lucide-react';
import Markdown from 'react-markdown';

export default function StudentAnalysis() {
  const { token } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [selectedSub, setSelectedSub] = useState<any>(null);

  useEffect(() => {
    fetch('/api/submissions/student', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      const released = data.filter((s: any) => s.results_released);
      setSubmissions(released);
      if (released.length > 0) setSelectedSub(released[0]);
    });
  }, [token]);

  return (
    <div className="space-y-8 transition-colors duration-300">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 text-emerald-500 mb-2">
            <Sparkles size={20} />
            <span className="text-xs font-bold uppercase tracking-widest">AI Performance Insights</span>
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Learning Analysis</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Deep dive into your strengths and areas for improvement.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-sm font-bold text-zinc-500 uppercase px-2">Select Examination</h3>
          <div className="space-y-2">
            {submissions.map((sub: any) => (
              <button 
                key={sub.id}
                onClick={() => setSelectedSub(sub)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group shadow-sm ${
                  selectedSub?.id === sub.id 
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-white shadow-glow' 
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div>
                  <p className="text-sm font-bold">{sub.exam_title}</p>
                  <p className="text-[10px] uppercase tracking-wider opacity-60">Score: {sub.score}/100</p>
                </div>
                <ChevronRight size={16} className={`transition-transform ${selectedSub?.id === sub.id ? 'translate-x-1' : ''}`} />
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          {selectedSub ? (
            <motion.div 
              key={selectedSub.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-glow dark:shadow-none transition-all flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <BrainCircuit className="text-purple-500" size={20} />
                    <div className="text-sm font-bold text-zinc-900 dark:text-white">Cognitive</div>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed flex-1">
                    {selectedSub.cognitive_analysis || "Pattern Analysis pending..."}
                  </p>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-glow dark:shadow-none transition-all flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="text-emerald-500" size={20} />
                    <div className="text-sm font-bold text-zinc-900 dark:text-white">Focus</div>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed flex-1">
                    {selectedSub.focus_analysis || "Attention Score pending..."}
                  </p>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-glow dark:shadow-none transition-all flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="text-blue-500" size={20} />
                    <div className="text-sm font-bold text-zinc-900 dark:text-white">Growth</div>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed flex-1">
                    {selectedSub.growth_analysis || "Improvement Rate pending..."}
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 relative overflow-hidden shadow-glow dark:shadow-none transition-all">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-3xl rounded-full -mr-32 -mt-32" />
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                  <Sparkles size={20} className="text-emerald-500" />
                  AI Feedback Report
                </h2>
                <div className="prose dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  <Markdown>{selectedSub.ai_analysis}</Markdown>
                </div>
              </div>

              {selectedSub.detailed_feedback && (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-glow dark:shadow-none transition-all">
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                    <CheckCircle size={20} className="text-emerald-500" />
                    Detailed Question Breakdown & Apt Answers
                  </h2>
                  <div className="prose dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    <Markdown>{selectedSub.detailed_feedback}</Markdown>
                  </div>
                </div>
              )}

              <div className="bg-emerald-600/10 border border-emerald-500/20 rounded-2xl p-6 shadow-glow">
                <h3 className="text-emerald-500 font-bold mb-2">Next Steps</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  {selectedSub.growth_analysis ? `Based on your performance, we recommend: ${selectedSub.growth_analysis}` : `Based on your performance in ${selectedSub.exam_title}, we recommend reviewing the core concepts and practicing more MCQ-style logic questions.`}
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 border-dashed rounded-3xl shadow-sm">
              <Sparkles size={48} className="text-zinc-300 dark:text-zinc-800 mb-4" />
              <p className="text-zinc-500">Select an approved submission to view AI analysis.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
