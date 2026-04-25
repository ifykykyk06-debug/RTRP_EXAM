import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';
import { Upload, File, Trash2, Download, CheckCircle } from 'lucide-react';

export default function TeacherMaterials() {
  const { token } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ title: '', description: '', file_url: '' });
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    fetch('/api/materials', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(setMaterials);
  }, [token]);

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
        setNewMaterial({ ...newMaterial, file_url: data.url });
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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterial.file_url) {
      alert('Please upload a file first');
      return;
    }
    const res = await fetch('/api/materials', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newMaterial)
    });
    if (res.ok) {
      setMaterials([...materials, { ...newMaterial, id: Date.now() }] as any);
      setIsUploading(false);
      setNewMaterial({ title: '', description: '', file_url: '' });
    }
  };

  return (
    <div className="space-y-8 transition-colors duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Study Materials</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Upload resources and notes for your students.</p>
        </div>
        <button 
          onClick={() => setIsUploading(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
        >
          <Upload size={20} />
          Upload Material
        </button>
      </div>

      {isUploading && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 max-w-2xl shadow-glow dark:shadow-none transition-all"
        >
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Title</label>
              <input 
                type="text"
                required
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="e.g. Python Data Structures PDF"
                value={newMaterial.title}
                onChange={e => setNewMaterial({...newMaterial, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Description</label>
              <textarea 
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 h-24"
                placeholder="Brief summary of the material..."
                value={newMaterial.description}
                onChange={e => setNewMaterial({...newMaterial, description: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Upload File</label>
              <div className="relative group">
                <input 
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label 
                  htmlFor="file-upload"
                  className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all ${
                    newMaterial.file_url 
                    ? 'bg-emerald-500/5 border-emerald-500/50 shadow-glow' 
                    : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50'
                  }`}
                >
                  <Upload className={`w-8 h-8 mb-2 ${newMaterial.file_url ? 'text-emerald-500' : 'text-zinc-400'}`} />
                  <span className="text-sm font-medium text-zinc-500">
                    {uploadingFile ? 'Uploading...' : newMaterial.file_url ? 'File Ready' : 'Click to select file'}
                  </span>
                  <span className="text-[10px] text-zinc-400 mt-1 uppercase tracking-widest">Doc, Image, Video, PDF</span>
                </label>
              </div>
              {newMaterial.file_url && (
                <p className="mt-2 text-xs text-emerald-500 flex items-center gap-1 font-medium">
                  <CheckCircle size={12} /> File uploaded successfully
                </p>
              )}
            </div>
            <div className="flex justify-end gap-4 pt-4">
              <button 
                type="button"
                onClick={() => setIsUploading(false)}
                className="px-6 py-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-medium transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-2 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20"
              >
                Publish Material
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {materials.map((mat: any) => (
          <motion.div 
            key={mat.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl group hover:border-emerald-500/50 transition-all shadow-glow dark:shadow-none"
          >
            <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-950 rounded-xl flex items-center justify-center text-emerald-500 mb-4 border border-zinc-200 dark:border-zinc-800 group-hover:bg-emerald-500/10 transition-all shadow-sm">
              <File size={24} />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{mat.title}</h3>
            <p className="text-sm text-zinc-500 mb-6 line-clamp-2">{mat.description}</p>
            <div className="flex justify-between items-center">
              <a 
                href={mat.file_url} 
                target="_blank" 
                rel="noreferrer"
                className="text-emerald-500 hover:text-emerald-400 text-sm font-bold flex items-center gap-2"
              >
                <Download size={16} /> Download
              </a>
              <button className="text-zinc-400 hover:text-red-500 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
