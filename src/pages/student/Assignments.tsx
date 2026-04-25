import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';
import { FileText, Download, Clock, CheckCircle } from 'lucide-react';

export default function StudentAssignments() {
  const { token } = useAuth();
  const [materials, setMaterials] = useState([]);

  useEffect(() => {
    fetch('/api/materials', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(setMaterials);
  }, [token]);

  return (
    <div className="space-y-8 transition-colors duration-300">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Assignments & Materials</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Access study resources and assignment details.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {materials.map((mat: any) => (
          <motion.div 
            key={mat.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl group hover:border-emerald-500/50 transition-all shadow-glow dark:shadow-none"
          >
            <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-950 rounded-xl flex items-center justify-center text-emerald-500 mb-4 border border-zinc-200 dark:border-zinc-800 group-hover:bg-emerald-500/10 transition-all shadow-sm">
              <FileText size={24} />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{mat.title}</h3>
            <p className="text-sm text-zinc-500 mb-6 line-clamp-2">{mat.description}</p>
            <div className="flex justify-between items-center">
              <a 
                href={mat.file_url} 
                target="_blank" 
                rel="noreferrer"
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
              >
                <Download size={14} /> View / Download
              </a>
              <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-bold uppercase">
                <Clock size={12} /> Resource
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
