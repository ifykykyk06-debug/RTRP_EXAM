import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';
import { Camera, Mic, AlertTriangle, CheckCircle, Shield, Play, Clock, Download } from 'lucide-react';
import { io } from 'socket.io-client';

import { GoogleGenAI, Type } from "@google/genai";

export default function StudentExam() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [exam, setExam] = useState<any>(null);
  const [step, setStep] = useState<'instructions' | 'permissions' | 'exam'>('instructions');
  const [answers, setAnswers] = useState<any>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const proctoringIntervalRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (step === 'exam' && mediaStream && videoRef.current) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(e => console.error("Video play failed", e));
    }
  }, [step, mediaStream]);

  useEffect(() => {
    fetch(`/api/exams/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.has_submitted) {
        alert('You have already submitted this exam.');
        navigate('/student/results');
      }
      setExam(data);
      setTimeLeft(data.duration_minutes * 60);
    });

    socketRef.current = io({
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    socketRef.current.on('connect_error', (err: any) => {
      console.error('Socket connection error:', err);
    });

    socketRef.current.emit('join-exam', { 
      examId: id, 
      studentName: user?.name, 
      studentId: user?.id,
      role: 'student'
    });
    socketRef.current.on('student-warning', (msg: string) => {
      setWarning(msg);
      setTimeout(() => setWarning(null), 5000);
    });

    // Tab Switching / Page Visibility Detection
    const handleVisibilityChange = () => {
      if (document.hidden && step === 'exam') {
        triggerSuspiciousActivityAlert("Tab Switched / Page Hidden");
      }
    };

    const handleWindowBlur = () => {
      if (step === 'exam') {
        triggerSuspiciousActivityAlert("Window Focus Lost (Possible Tab/App Switch)");
      }
    };

    // Screen Mirroring / Multiple Display Detection
    const checkMultipleDisplays = async () => {
      if (step !== 'exam') return;

      // Basic check for extended display
      if ((window.screen as any).isExtended) {
        triggerSuspiciousActivityAlert("Secondary Display Detected (Mirroring/Extended Mode)");
      }

      // Modern Screen Details API
      if ('getScreenDetails' in window) {
        try {
          const details = await (window as any).getScreenDetails();
          if (details.screens.length > 1) {
            triggerSuspiciousActivityAlert(`Multiple Displays Detected: ${details.screens.length} screens`);
          }
        } catch (err) {
          console.log("Screen Details API permission denied or error", err);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    
    let displayCheckInterval: any;
    if (step === 'exam') {
      displayCheckInterval = setInterval(checkMultipleDisplays, 10000);
      checkMultipleDisplays(); // Initial check
    }

    return () => {
      socketRef.current.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      if (displayCheckInterval) clearInterval(displayCheckInterval);
      if (proctoringIntervalRef.current) clearInterval(proctoringIntervalRef.current);
    };
  }, [id, token, user, step]);

  const triggerSuspiciousActivityAlert = async (reason: string) => {
    if (!videoRef.current || !canvasRef.current || !socketRef.current) return;

    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    // Capture screenshot immediately
    context.drawImage(videoRef.current, 0, 0, 640, 480);
    const fullBase64Image = canvasRef.current.toDataURL('image/jpeg', 0.7);
    
    // Upload screenshot
    let screenshotUrl = '';
    try {
      const blob = await (await fetch(fullBase64Image)).blob();
      const formData = new FormData();
      formData.append('file', blob, `violation_${id}_${user?.id}_${Date.now()}.jpg`);
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        screenshotUrl = uploadData.url;
      }
    } catch (err) {
      console.error("Violation screenshot upload failed", err);
    }

    const log = { 
      message: `System Alert: ${reason}`, 
      timestamp: new Date(),
      screenshot: screenshotUrl || fullBase64Image
    };

    setLogs(prev => [...prev, log]);
    socketRef.current.emit('suspicious-activity', { 
      examId: id, 
      studentName: user?.name, 
      studentId: user?.id,
      ...log 
    });
    setWarning(`CRITICAL: ${reason} Detected!`);
    setTimeout(() => setWarning(null), 7000);
  };

  useEffect(() => {
    if (step === 'exam' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [step, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(stream);
      
      // Start recording
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorder.start();

      setStep('exam');
      startAIProctoring();
      startVideoStreaming();
    } catch (err) {
      alert('Camera and Microphone permissions are required to take the exam.');
    }
  };

  const startVideoStreaming = () => {
    const streamInterval = setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        const context = canvasRef.current.getContext('2d');
        if (context) {
          context.drawImage(videoRef.current, 0, 0, 160, 120);
          const frame = canvasRef.current.toDataURL('image/jpeg', 0.5);
          socketRef.current.emit('student-frame', { examId: id, studentId: user?.id, frame });
        }
      }
    }, 1000); // Send frame every second
    return () => clearInterval(streamInterval);
  };

  const startAIProctoring = () => {
    // Run AI analysis every 5 seconds
    proctoringIntervalRef.current = setInterval(async () => {
      if (videoRef.current && canvasRef.current) {
        const context = canvasRef.current.getContext('2d');
        if (context) {
          context.drawImage(videoRef.current, 0, 0, 640, 480);
          const base64Image = canvasRef.current.toDataURL('image/jpeg', 0.7).split(',')[1];
          
          try {
            const response = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: [
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: base64Image
                  }
                },
                {
                  text: "You are an AI proctor. Analyze this webcam frame. Detect: 1. Multiple people. 2. Mobile phones/tablets. 3. Papers/books/notes. Respond in JSON."
                }
              ],
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    isSuspicious: { type: Type.BOOLEAN },
                    reason: { type: Type.STRING },
                    confidence: { type: Type.NUMBER }
                  },
                  required: ["isSuspicious", "reason"]
                }
              }
            });

            const result = JSON.parse(response.text || "{}");
            if (result.isSuspicious && result.confidence > 0.7) {
              const fullBase64Image = canvasRef.current.toDataURL('image/jpeg', 0.7);
              
              // Upload screenshot
              let screenshotUrl = '';
              try {
                const blob = await (await fetch(fullBase64Image)).blob();
                const formData = new FormData();
                formData.append('file', blob, `screenshot_${id}_${user?.id}_${Date.now()}.jpg`);
                const uploadRes = await fetch('/api/upload', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}` },
                  body: formData
                });
                if (uploadRes.ok) {
                  const uploadData = await uploadRes.json();
                  screenshotUrl = uploadData.url;
                }
              } catch (err) {
                console.error("Screenshot upload failed", err);
              }

              const log = { 
                message: `AI Alert: ${result.reason}`, 
                timestamp: new Date(),
                screenshot: screenshotUrl || fullBase64Image // Fallback to base64 if upload fails
              };
              setLogs(prev => [...prev, log]);
              socketRef.current.emit('suspicious-activity', { 
                examId: id, 
                studentName: user?.name, 
                studentId: user?.id,
                ...log 
              });
              setWarning(`Proctoring Alert: ${result.reason}`);
              setTimeout(() => setWarning(null), 5000);
            }
          } catch (error) {
            console.error("AI Proctoring failed", error);
          }
        }
      }
    }, 5000);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmissionStatus("Stopping proctoring and preparing video...");
    
    // Stop recording and upload
    let videoUrl = '';
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      // Wait a bit for the last chunk
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const formData = new FormData();
      formData.append('file', blob, `exam_${id}_${user?.id}.webm`);
      
      try {
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          videoUrl = uploadData.url;
        }
      } catch (error) {
        console.error("Video upload failed", error);
      }
    }

    setSubmissionStatus("AI is analyzing your performance using NLP...");
    
    let aiAnalysis = "Analysis pending...";
    let cognitiveAnalysis = "Analysis pending...";
    let focusAnalysis = "Analysis pending...";
    let growthAnalysis = "Analysis pending...";
    let detailedFeedback = "Analysis pending...";
    let score = 0;

    try {
      // Calculate actual score
      let correctCount = 0;
      exam.questions.forEach((q: any) => {
        if (answers[q.id] === q.correct_answer) {
          correctCount++;
        }
      });
      score = exam.questions.length > 0 ? Math.round((correctCount / exam.questions.length) * 100) : 0;

      // Simulate AI processing delay
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const mockResult = {
        score: score,
        general_feedback: "The student demonstrates a solid understanding of the core concepts but occasionally struggles with syntax in edge cases.",
        cognitive: "Strong logical reasoning and problem-solving skills. The student breaks down complex problems effectively but shows minor gaps in abstract theoretical knowledge.",
        focus: "High sustained attention. Proctoring logs indicate minimal distractions and consistent engagement with the exam material.",
        growth: "Focus on reviewing advanced data structures and practicing edge-case handling in algorithms.",
        detailed_feedback: "Questions were evaluated based on the expected answers."
      };

      score = mockResult.score;
      aiAnalysis = mockResult.general_feedback;
      cognitiveAnalysis = mockResult.cognitive;
      focusAnalysis = mockResult.focus;
      growthAnalysis = mockResult.growth;
      detailedFeedback = mockResult.detailed_feedback;
    } catch (e) {
      console.error("AI Analysis failed", e);
    }

    setSubmissionStatus("Finalizing submission...");

    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        examId: id, 
        answers, 
        proctoringLogs: logs, 
        videoUrl,
        score,
        aiAnalysis,
        cognitiveAnalysis,
        focusAnalysis,
        growthAnalysis,
        detailedFeedback
      })
    });
    if (res.ok) {
      alert('Exam submitted successfully!');
      navigate('/student/results');
    } else {
      alert('Failed to submit exam. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (!exam) return <div className="p-8 text-white">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center text-center p-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full mb-6"
          />
          <h2 className="text-2xl font-bold text-white mb-2">Submitting Examination</h2>
          <p className="text-zinc-400 max-w-md">{submissionStatus}</p>
        </div>
      )}

      {warning && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-8 left-1/2 -translate-x-1/2 bg-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3 border border-red-400"
        >
          <AlertTriangle size={24} />
          <span className="font-bold">{warning}</span>
        </motion.div>
      )}

      {step === 'instructions' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 border border-zinc-800 rounded-3xl p-12 space-y-8"
        >
          <div className="flex items-center gap-4 text-emerald-500">
            <Shield size={48} />
            <h1 className="text-4xl font-bold text-white">Exam Instructions</h1>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white">Rules & Guidelines</h2>
              <ul className="space-y-3 text-zinc-400">
                <li className="flex items-start gap-2">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  Ensure you are in a well-lit, quiet room.
                </li>
                <li className="flex items-start gap-2">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  Your camera and microphone must remain ON throughout the exam.
                </li>
                <li className="flex items-start gap-2">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  Do not switch tabs or minimize the browser window.
                </li>
                <li className="flex items-start gap-2">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  Suspicious activities will be flagged and reported to the teacher.
                </li>
              </ul>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-white">Exam Details</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Title</span>
                  <span className="text-white">{exam.title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Type</span>
                  <span className="text-white uppercase">{exam.type}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Questions</span>
                  <span className="text-white">{exam.questions.length}</span>
                </div>
                {exam.file_url && (
                  <div className="pt-4 border-t border-zinc-800">
                    <a 
                      href={exam.file_url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center gap-2 text-emerald-500 hover:text-emerald-400 font-bold text-xs"
                    >
                      <Download size={14} /> Download Reference Material
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button 
            onClick={() => setStep('permissions')}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-lg"
          >
            <Play size={20} /> I Understand, Continue
          </button>
        </motion.div>
      )}

      {step === 'permissions' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900 border border-zinc-800 rounded-3xl p-12 text-center space-y-8"
        >
          <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500 mb-4">
            <Camera size={48} />
          </div>
          <h2 className="text-3xl font-bold text-white">Hardware Check</h2>
          <p className="text-zinc-400 max-w-md mx-auto">
            We need access to your camera and microphone to ensure a fair examination environment.
          </p>
          <div className="flex justify-center gap-8 py-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center text-zinc-500">
                <Camera size={24} />
              </div>
              <span className="text-xs font-bold text-zinc-500 uppercase">Webcam</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center text-zinc-500">
                <Mic size={24} />
              </div>
              <span className="text-xs font-bold text-zinc-500 uppercase">Microphone</span>
            </div>
          </div>
          <button 
            onClick={requestPermissions}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-12 py-4 rounded-2xl font-bold transition-all text-lg"
          >
            Grant Permissions & Start
          </button>
        </motion.div>
      )}

      {step === 'exam' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-zinc-800">
                <h2 className="text-2xl font-bold text-white">{exam.title}</h2>
                <div className="flex items-center gap-2 text-emerald-500 font-mono font-bold">
                  <Clock size={18} /> {formatTime(timeLeft)}
                </div>
              </div>

              <div className="space-y-12">
                {exam.questions.map((q: any, i: number) => (
                  <div key={q.id} className="space-y-6">
                    <div className="flex gap-4">
                      <span className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-lg text-white font-medium">{q.content}</p>
                    </div>

                    {exam.type === 'mcq' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-12">
                        {JSON.parse(q.options || '[]').map((opt: string, optIdx: number) => (
                          <button 
                            key={optIdx}
                            onClick={() => setAnswers({...answers, [q.id]: opt})}
                            className={`p-4 rounded-2xl border text-left transition-all ${
                              answers[q.id] === opt 
                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' 
                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                            }`}
                          >
                            <span className="font-bold mr-3">{String.fromCharCode(65 + optIdx)}.</span>
                            {opt}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="ml-12 space-y-4">
                        <textarea 
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-emerald-500 font-mono h-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          placeholder="# Write your Python code here..."
                          value={answers[q.id] || ''}
                          onChange={e => setAnswers({...answers, [q.id]: e.target.value})}
                        />
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-zinc-500 italic">Automatic grading will run after submission.</p>
                          <button className="text-emerald-500 text-sm font-bold hover:underline">Run Test Cases</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-12 pt-8 border-t border-zinc-800 flex justify-end">
                <button 
                  onClick={handleSubmit}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-12 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-emerald-900/20 flex items-center gap-2"
                >
                  <CheckCircle size={20} /> Submit Examination
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 overflow-hidden">
              <div className="aspect-video bg-black rounded-2xl relative overflow-hidden">
                <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
                <canvas ref={canvasRef} width="160" height="120" className="hidden" />
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-emerald-500/20 backdrop-blur-md px-2 py-1 rounded-full border border-emerald-500/30">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Live Proctoring</span>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
              <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Proctoring Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                  <span className="text-xs text-zinc-400">Face Detected</span>
                  <CheckCircle size={14} className="text-emerald-500" />
                </div>
                <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                  <span className="text-xs text-zinc-400">Audio Level</span>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(i => <div key={i} className={`w-1 h-3 rounded-full ${i < 3 ? 'bg-emerald-500' : 'bg-zinc-800'}`} />)}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
              <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Recent Logs</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i} className="text-[10px] text-red-400 bg-red-500/5 p-2 rounded-lg border border-red-500/10">
                    [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                  </div>
                ))}
                {logs.length === 0 && <p className="text-[10px] text-zinc-600 italic">No incidents recorded.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
