import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';
import { Users, FileText, CheckCircle, AlertTriangle, Camera, X } from 'lucide-react';
import Markdown from 'react-markdown';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { io } from 'socket.io-client';

export default function TeacherDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState({ exams: 0, submissions: 0, pending: 0 });
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [releasedExams, setReleasedExams] = useState<any[]>([]);
  const [activeStudents, setActiveStudents] = useState<any[]>([]);
  const [studentFrames, setStudentFrames] = useState<Record<number, string>>({});
  const [notification, setNotification] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const socketRef = useRef<any>(null);

  const handleApprove = async (id: number, score: number) => {
    const res = await fetch(`/api/submissions/${id}/approve`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ score })
    });
    if (res.ok) {
      setRecentSubmissions(prev => prev.map((s: any) => s.id === id ? { ...s, status: 'approved', score } : s));
      setStats(prev => ({ ...prev, pending: prev.pending - 1 }));
      alert('Submission approved and scored!');
    }
  };

  useEffect(() => {
    socketRef.current = io({
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 5,
      timeout: 10000,
    });
    
    socketRef.current.on('connect_error', (err: any) => {
      console.error('Socket connection error:', err);
    });

    socketRef.current.emit('join-exam', { role: 'teacher' });

    socketRef.current.on('exam-released', (data: any) => {
      setNotification(`Exam Released: ${data.title}`);
      setTimeout(() => setNotification(null), 5000);
      // Refresh released exams
      fetch('/api/exams', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setReleasedExams(data.filter((e: any) => e.is_released)));
    });

    socketRef.current.on('student-joined', (data: any) => {
      setActiveStudents(prev => {
        if (prev.find(s => s.studentId === data.studentId)) return prev;
        return [...prev, data];
      });
    });

    socketRef.current.on('student-left', (data: any) => {
      setActiveStudents(prev => prev.filter(s => s.studentId !== data.studentId));
      setStudentFrames(prev => {
        const next = { ...prev };
        delete next[data.studentId];
        return next;
      });
    });

    socketRef.current.on('teacher-frame', (data: any) => {
      setStudentFrames(prev => ({ ...prev, [data.studentId]: data.frame }));
    });

    socketRef.current.on('teacher-warning', (data: any) => {
      setNotification(`Suspicious activity from ${data.studentName}: ${data.message}`);
      if (data.screenshot) {
        // Show a more prominent alert with the screenshot
        setSelectedSubmission({
          student_name: data.studentName,
          exam_title: data.message,
          screenshot: data.screenshot,
          isLiveAlert: true
        });
      } else {
        alert(`Warning: Suspicious activity from ${data.studentName}: ${data.message}`);
      }
    });

    return () => socketRef.current.disconnect();
  }, []);

  useEffect(() => {
    fetch('/api/submissions/teacher', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      setRecentSubmissions(data.slice(0, 5));
      setStats({
        exams: new Set(data.map((s: any) => s.exam_id)).size,
        submissions: data.length,
        pending: data.filter((s: any) => s.status === 'pending').length
      });
    });

    fetch('/api/exams', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setReleasedExams(data.filter((e: any) => e.is_released)));
  }, [token]);

  const cards = [
    { label: 'Total Exams', value: stats.exams, icon: FileText, color: 'text-blue-500' },
    { label: 'Released Exams', value: releasedExams.length, icon: CheckCircle, color: 'text-emerald-500' },
  ];

  return (
    <div className="space-y-8 transition-colors duration-300">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Teacher Dashboard</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Overview of your classes and examinations.</p>
      </div>

      {notification && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold shadow-glow flex items-center gap-3"
        >
          <CheckCircle size={20} />
          {notification}
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <motion.div 
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-glow dark:shadow-none transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm ${card.color}`}>
                <card.icon size={24} />
              </div>
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{card.value}</div>
            <div className="text-sm text-zinc-500 font-medium uppercase tracking-wider mt-1">{card.label}</div>
          </motion.div>
        ))}
      </div>

      {activeStudents.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-glow dark:shadow-none transition-all">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Live Monitoring ({activeStudents.length})</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {activeStudents.map(student => (
              <div key={student.studentId} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 space-y-2 shadow-sm">
                <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                  {studentFrames[student.studentId] ? (
                    <img src={studentFrames[student.studentId]} className="w-full h-full object-cover" alt="Student Feed" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                      <Camera size={24} />
                    </div>
                  )}
                  <div className="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] text-white font-bold">
                    LIVE
                  </div>
                </div>
                <p className="text-[10px] font-bold text-zinc-900 dark:text-white truncate text-center">{student.studentName}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-glow dark:shadow-none transition-all">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-6">Released Examinations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {releasedExams.map((e: any) => (
            <div key={e.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-center shadow-sm">
              <div>
                <p className="text-sm font-bold text-zinc-900 dark:text-white">{e.title}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{e.type}</p>
              </div>
              <div className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-full uppercase">
                Active
              </div>
            </div>
          ))}
          {releasedExams.length === 0 && <p className="text-zinc-500 text-sm">No released exams yet.</p>}
        </div>
      </div>

      {selectedSubmission && selectedSubmission.isLiveAlert && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl p-8 shadow-glow-lg"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3 text-red-500">
                <AlertTriangle size={32} />
                <div>
                  <h2 className="text-2xl font-bold">Suspicious Activity Detected</h2>
                  <p className="text-zinc-500 dark:text-zinc-400">Student: {selectedSubmission.student_name}</p>
                </div>
              </div>
              <button onClick={() => setSelectedSubmission(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg mb-6">
              <img src={selectedSubmission.screenshot} className="w-full h-full object-contain" alt="Suspicious Activity Screenshot" />
            </div>
            
            <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl text-red-500 font-medium mb-6">
              Reason: {selectedSubmission.exam_title}
            </div>

            <button 
              onClick={() => setSelectedSubmission(null)}
              className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold py-4 rounded-2xl"
            >
              Acknowledge
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
