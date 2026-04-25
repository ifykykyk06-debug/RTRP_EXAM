import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';
import { Plus, Trash2, Code, List, Save } from 'lucide-react';

export default function TeacherAssignments() {
  const { token } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [exam, setExam] = useState({
    title: '',
    description: '',
    type: 'mcq',
    duration_minutes: 60,
    file_url: '',
    questions: [] as any[]
  });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setExam({ ...exam, file_url: data.url });
        alert('File uploaded successfully!');
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (err) {
      alert('Error uploading file');
    } finally {
      setUploadingFile(false);
    }
  };

  const addQuestion = () => {
    if (exam.type === 'mcq') {
      setExam({
        ...exam,
        questions: [...exam.questions, { content: '', options: ['', '', '', ''], correct_answer: '' }]
      });
    } else {
      setExam({
        ...exam,
        questions: [...exam.questions, { content: '', test_cases: [{ input: '', output: '' }] }]
      });
    }
  };

  const [exams, setExams] = useState([]);

  useEffect(() => {
    fetch('/api/exams', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(setExams);
  }, [token, isCreating]);

  const handleReleaseResults = async (id: number) => {
    const res = await fetch(`/api/exams/${id}/release-results`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      setExams(exams.map((e: any) => e.id === id ? { ...e, results_released: 1 } : e));
      alert('Results released to students!');
    }
  };

  const handleRelease = async (id: number) => {
    const res = await fetch(`/api/exams/${id}/release`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      setExams(exams.map((e: any) => e.id === id ? { ...e, is_released: 1 } : e));
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(exam)
      });
      if (res.ok) {
        setIsCreating(false);
        setExam({ title: '', description: '', type: 'mcq', duration_minutes: 60, file_url: '', questions: [] });
        alert('Exam created successfully!');
      }
    } catch (err) {
      alert('Error saving exam');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 transition-colors duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Assignments</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Create and manage your examination papers.</p>
        </div>
        {!isCreating && (
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus size={20} />
            Create New Exam
          </button>
        )}
      </div>

      {isCreating ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 space-y-6 shadow-glow dark:shadow-none transition-all"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Exam Title</label>
              <input 
                type="text"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="e.g. Midterm Python Basics"
                value={exam.title}
                onChange={e => setExam({...exam, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Exam Type</label>
              <div className="flex bg-zinc-50 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <button 
                  onClick={() => setExam({...exam, type: 'mcq', questions: []})}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${exam.type === 'mcq' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700' : 'text-zinc-500'}`}
                >
                  <List size={16} /> MCQ
                </button>
                <button 
                  onClick={() => setExam({...exam, type: 'coding', questions: []})}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${exam.type === 'coding' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700' : 'text-zinc-500'}`}
                >
                  <Code size={16} /> Coding
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Description</label>
            <textarea 
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 h-24"
              placeholder="Instructions for students..."
              value={exam.description}
              onChange={e => setExam({...exam, description: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Duration (Minutes)</label>
              <input 
                type="number"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="e.g. 60"
                value={isNaN(exam.duration_minutes) ? '' : exam.duration_minutes}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  setExam({...exam, duration_minutes: isNaN(val) ? 0 : val});
                }}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Reference Material (Optional)</label>
              <div className="relative group">
                <input 
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  id="exam-file-upload"
                />
                <label 
                  htmlFor="exam-file-upload"
                  className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all h-24 ${
                    exam.file_url 
                    ? 'bg-emerald-500/5 border-emerald-500/50 shadow-glow' 
                    : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50'
                  }`}
                >
                  <Plus className={`w-6 h-6 mb-1 ${exam.file_url ? 'text-emerald-500' : 'text-zinc-400'}`} />
                  <span className="text-xs font-medium text-zinc-500">
                    {uploadingFile ? 'Uploading...' : exam.file_url ? 'File Attached' : 'Attach Reference File'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Questions ({exam.questions.length})</h3>
              <button 
                onClick={addQuestion}
                className="text-emerald-500 hover:text-emerald-400 text-sm font-bold flex items-center gap-1"
              >
                <Plus size={16} /> Add Question
              </button>
            </div>

            {exam.questions.map((q, i) => (
              <div key={i} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 relative shadow-sm">
                <button 
                  onClick={() => setExam({...exam, questions: exam.questions.filter((_, idx) => idx !== i)})}
                  className="absolute top-4 right-4 text-zinc-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
                
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">Question {i + 1}</label>
                  <input 
                    type="text"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Enter question text..."
                    value={q.content}
                    onChange={e => {
                      const qs = [...exam.questions];
                      qs[i].content = e.target.value;
                      setExam({...exam, questions: qs});
                    }}
                  />
                </div>

                {exam.type === 'mcq' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.options.map((opt: string, optIdx: number) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name={`correct-${i}`}
                          checked={q.correct_answer === opt && opt !== ''}
                          onChange={() => {
                            const qs = [...exam.questions];
                            qs[i].correct_answer = opt;
                            setExam({...exam, questions: qs});
                          }}
                        />
                        <input 
                          type="text"
                          className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none"
                          placeholder={`Option ${optIdx + 1}`}
                          value={opt}
                          onChange={e => {
                            const qs = [...exam.questions];
                            qs[i].options[optIdx] = e.target.value;
                            setExam({...exam, questions: qs});
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">Test Case Input</label>
                        <input 
                          type="text"
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none"
                          value={q.test_cases[0].input}
                          onChange={e => {
                            const qs = [...exam.questions];
                            qs[i].test_cases[0].input = e.target.value;
                            setExam({...exam, questions: qs});
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">Expected Output</label>
                        <input 
                          type="text"
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none"
                          value={q.test_cases[0].output}
                          onChange={e => {
                            const qs = [...exam.questions];
                            qs[i].test_cases[0].output = e.target.value;
                            setExam({...exam, questions: qs});
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <button 
              onClick={() => setIsCreating(false)}
              className="px-6 py-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-medium transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-8 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
            >
              <Save size={18} /> {isSaving ? 'Saving...' : 'Save Exam'}
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4 border-dashed border-2 hover:border-emerald-500/50 transition-all group shadow-glow dark:shadow-none"
          >
            <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-950 rounded-full flex items-center justify-center text-zinc-400 group-hover:text-emerald-500 transition-colors shadow-sm">
              <Plus size={24} />
            </div>
            <p className="text-zinc-500 text-sm font-medium">Create New Exam</p>
          </button>

          {exams.map((e: any) => (
            <motion.div 
              key={e.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl flex flex-col justify-between shadow-glow dark:shadow-none transition-all"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-2 rounded-lg shadow-sm ${e.type === 'mcq' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}>
                    {e.type === 'mcq' ? <List size={20} /> : <Code size={20} />}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${e.is_released ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {e.is_released ? 'Released' : 'Draft'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{e.title}</h3>
                <p className="text-sm text-zinc-500 line-clamp-2 mb-4">{e.description}</p>
              </div>
              
              {!e.is_released ? (
                <button 
                  onClick={() => handleRelease(e.id)}
                  className="w-full bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white py-2 rounded-xl text-sm font-bold transition-all border border-emerald-500/20 shadow-sm"
                >
                  Release Exam
                </button>
              ) : (
                <button 
                  onClick={() => handleReleaseResults(e.id)}
                  disabled={e.results_released}
                  className={`w-full py-2 rounded-xl text-sm font-bold transition-all border shadow-sm ${
                    e.results_released 
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700 cursor-not-allowed' 
                    : 'bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white border-blue-500/20'
                  }`}
                >
                  {e.results_released ? 'Results Released' : 'Release Results'}
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
