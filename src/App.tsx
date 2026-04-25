import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useState, useEffect } from 'react';
import AuthPage from './pages/AuthPage';
import TeacherDashboard from './pages/teacher/Dashboard';
import TeacherAssignments from './pages/teacher/Assignments';
import TeacherAnalysis from './pages/teacher/Analysis';
import TeacherMaterials from './pages/teacher/Materials';
import StudentDashboard from './pages/student/Dashboard';
import StudentAssignments from './pages/student/Assignments';
import StudentExam from './pages/student/Exam';
import StudentResults from './pages/student/Results';
import StudentAnalysis from './pages/student/Analysis';
import { LayoutDashboard, BookOpen, BarChart3, FileText, LogOut, GraduationCap, Sun, Moon } from 'lucide-react';

function ProtectedRoute({ children, role }: { children: React.ReactNode, role: string }) {
  const { user, token } = useAuth();
  if (!token) return <Navigate to="/" />;
  if (user?.role !== role) return <Navigate to="/" />;
  return <>{children}</>;
}

function Sidebar({ role, theme, toggleTheme }: { role: 'teacher' | 'student', theme: 'dark' | 'light', toggleTheme: () => void }) {
  const { logout, user } = useAuth();
  const location = useLocation();

  const teacherLinks = [
    { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/teacher/assignments', label: 'Assignments', icon: FileText },
    { to: '/teacher/analysis', label: 'Analysis', icon: BarChart3 },
    { to: '/teacher/materials', label: 'Materials', icon: BookOpen },
  ];

  const studentLinks = [
    { to: '/student', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/student/assignments', label: 'Assignments', icon: FileText },
    { to: '/student/results', label: 'Results', icon: BarChart3 },
    { to: '/student/analysis', label: 'AI Analysis', icon: GraduationCap },
  ];

  const links = role === 'teacher' ? teacherLinks : studentLinks;

  return (
    <div className="w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-screen sticky top-0 transition-colors shadow-glow dark:shadow-none">
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
        <Link to={role === 'teacher' ? '/teacher' : '/student'} className="flex items-center gap-3 group">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-glow">
            <GraduationCap className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-zinc-900 dark:text-white text-lg">EduGuard</span>
        </Link>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {links.map(link => (
          <Link 
            key={link.to}
            to={link.to}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              location.pathname === link.to 
                ? 'bg-emerald-500/10 text-emerald-500' 
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <link.icon size={20} />
            <span className="font-medium">{link.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
        <button 
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white transition-all"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          <span className="font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-900 dark:text-white uppercase">
            {user?.name[0]}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-zinc-900 dark:text-white truncate max-w-[120px]">{user?.name}</span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{user?.role}</span>
          </div>
        </div>
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-red-500/10 hover:text-red-500 transition-all"
        >
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
      
      {/* Teacher Routes */}
      <Route path="/teacher/*" element={
        <ProtectedRoute role="teacher">
          <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
            <Sidebar role="teacher" theme={theme} toggleTheme={toggleTheme} />
            <main className="flex-1 p-8 overflow-y-auto">
              <Routes>
                <Route path="/" element={<TeacherDashboard />} />
                <Route path="/assignments" element={<TeacherAssignments />} />
                <Route path="/analysis" element={<TeacherAnalysis />} />
                <Route path="/materials" element={<TeacherMaterials />} />
              </Routes>
            </main>
          </div>
        </ProtectedRoute>
      } />

      {/* Student Routes */}
      <Route path="/student/*" element={
        <ProtectedRoute role="student">
          <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
            <Sidebar role="student" theme={theme} toggleTheme={toggleTheme} />
            <main className="flex-1 p-8 overflow-y-auto">
              <Routes>
                <Route path="/" element={<StudentDashboard />} />
                <Route path="/assignments" element={<StudentAssignments />} />
                <Route path="/exam/:id" element={<StudentExam />} />
                <Route path="/results" element={<StudentResults />} />
                <Route path="/analysis" element={<StudentAnalysis />} />
              </Routes>
            </main>
          </div>
        </ProtectedRoute>
      } />
    </Routes>
  );
}
