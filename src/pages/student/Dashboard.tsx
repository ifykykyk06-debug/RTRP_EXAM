import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';
import { BookOpen, FileText, CheckCircle, Clock, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function StudentDashboard() {
  const { token, user } = useAuth();
  const [exams, setExams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [notification, setNotification] = useState<string | null>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    socketRef.current = io({
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 5,
      timeout: 10000,
    });
    
    socketRef.current.on('connect_error', (err: any) => {
      console.error('Socket connection error:', err);
    });
    
    socketRef.current.on('exam-released', (data: any) => {
      setNotification(`New Exam Released: ${data.title}! You can now attempt it.`);
      setTimeout(() => setNotification(null), 8000);
      
      // Refresh exams
      fetch('/api/exams', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setExams(data.filter((e: any) => e.is_released && !e.has_submitted)));
    });

    return () => socketRef.current.disconnect();
  }, [token]);

  useEffect(() => {
    fetch('/api/exams', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setExams(data.filter((e: any) => e.is_released && !e.has_submitted)));

    fetch('/api/submissions/student', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(setSubmissions);

    fetch('/api/materials', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(setMaterials);
  }, [token]);

  const stats = [
    { label: 'Available Exams', value: exams.length, icon: FileText, color: 'text-blue-500' },
    { label: 'Materials', value: materials.length, icon: BookOpen, color: 'text-emerald-500' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Welcome, {user?.name}</h1>
        <p className="text-zinc-400 mt-1">Here is your academic overview.</p>
      </div>

      {notification && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-600 text-white p-4 rounded-2xl font-bold shadow-xl flex items-center gap-3 border border-emerald-500/50"
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center animate-bounce">
            <FileText size={20} />
          </div>
          {notification}
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-glow dark:shadow-none transition-all"
          >
            <div className={`p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-fit mb-4 ${stat.color} shadow-sm`}>
              <stat.icon size={24} />
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{stat.value}</div>
            <div className="text-sm text-zinc-500 font-medium uppercase tracking-wider mt-1">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-glow dark:shadow-none transition-all">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-6">Upcoming Examinations</h2>
          <div className="space-y-4">
            {exams.map((exam: any) => (
              <div key={exam.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 group hover:border-emerald-500/50 transition-all shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-glow">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{exam.title}</p>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">{exam.type}</p>
                  </div>
                </div>
                {exam.has_submitted ? (
                  <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-500/20">
                    <CheckCircle size={14} /> Submitted
                  </div>
                ) : (
                  <Link 
                    to={`/student/exam/${exam.id}`}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Start Exam
                  </Link>
                )}
              </div>
            ))}
            {exams.length === 0 && <p className="text-zinc-500 text-sm text-center py-8">No exams available at the moment.</p>}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-glow dark:shadow-none transition-all">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-6">Recent Materials</h2>
          <div className="space-y-4">
            {materials.slice(0, 3).map((mat: any) => (
              <div key={mat.id} className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 group hover:border-blue-500/50 transition-all shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-glow">
                  <BookOpen size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{mat.title}</p>
                  <p className="text-xs text-zinc-500 truncate">{mat.description}</p>
                </div>
                <a 
                  href={mat.file_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  <Download size={18} />
                </a>
              </div>
            ))}
            {materials.length === 0 && <p className="text-zinc-500 text-sm text-center py-8">No materials available yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
