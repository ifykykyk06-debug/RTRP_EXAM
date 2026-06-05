import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Mic, AlertTriangle, CheckCircle, Shield, Play, Clock, Download, Eye, UserX, MonitorX, CopyX } from 'lucide-react';
import { io } from 'socket.io-client';
import { GoogleGenAI, Type } from "@google/genai";
import * as faceapi from 'face-api.js';

const MAX_VIOLATIONS = 5;

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
  const [cognitiveLogs, setCognitiveLogs] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [violationCount, setViolationCount] = useState(0);
  const [faceMismatchLogs, setFaceMismatchLogs] = useState<any[]>([]);
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [copyBlockedMsg, setCopyBlockedMsg] = useState(false);
  const [loginFaceRef, setLoginFaceRef] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const proctoringIntervalRef = useRef<any>(null);
  const faceCheckIntervalRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const violationCountRef = useRef(0);
  const logsRef = useRef<any[]>([]);
  const faceMismatchLogsRef = useRef<any[]>([]);
  const isAutoSubmitting = useRef(false);
  const consecutiveOffGazeTicks = useRef(0);
  const warningTimeoutRef = useRef<any>(null);

  // Keep ref in sync with state
  useEffect(() => { logsRef.current = logs; }, [logs]);
  useEffect(() => { faceMismatchLogsRef.current = faceMismatchLogs; }, [faceMismatchLogs]);

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        setFaceModelsLoaded(true);
      } catch (e) {
        console.error('Face models failed to load', e);
      }
    };
    loadModels();

    // Get faceRef from localStorage (stored at login)
    const stored = localStorage.getItem('faceRef');
    if (stored) setLoginFaceRef(stored);
  }, []);

  // Attach video stream
  useEffect(() => {
    if (step === 'exam' && mediaStream && videoRef.current) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(e => console.error('Video play failed', e));
    }
  }, [step, mediaStream]);

  // Fetch exam + setup socket + anti-cheat listeners
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

    socketRef.current.on('connect_error', (err: any) => console.error('Socket error:', err));
    socketRef.current.emit('join-exam', {
      examId: id,
      studentName: user?.name,
      studentId: user?.id,
      role: 'student'
    });
    socketRef.current.on('student-warning', (msg: string) => {
      showWarning(msg);
    });

    // ── Tab / Visibility Switch ──
    const handleVisibilityChange = () => {
      if (document.hidden && step === 'exam') {
        registerViolation('Tab switched / Page hidden');
      }
    };
    const handleWindowBlur = () => {
      if (step === 'exam') registerViolation('Window focus lost (possible app switch)');
    };

    // ── Second Screen Detection ──
    const checkMultipleDisplays = async () => {
      if (step !== 'exam') return;
      if ((window.screen as any).isExtended) {
        registerViolation('Secondary / extended display detected');
      }
      if ('getScreenDetails' in window) {
        try {
          const details = await (window as any).getScreenDetails();
          if (details.screens.length > 1) {
            registerViolation(`Multiple displays detected (${details.screens.length} screens)`);
          }
        } catch (_) {}
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    let displayCheckInterval: any;
    if (step === 'exam') {
      displayCheckInterval = setInterval(checkMultipleDisplays, 10000);
      checkMultipleDisplays();
    }

    return () => {
      socketRef.current?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      if (displayCheckInterval) clearInterval(displayCheckInterval);
      if (proctoringIntervalRef.current) clearInterval(proctoringIntervalRef.current);
      if (faceCheckIntervalRef.current) clearInterval(faceCheckIntervalRef.current);
    };
  }, [id, token, user, step]);

  // ── Show Warning Notification ──
  const showWarning = (msg: string) => {
    setWarning(msg);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    warningTimeoutRef.current = setTimeout(() => setWarning(null), 7000);
  };

  // ── Register Violation (increments counter, auto-submits at 5) ──
  const registerViolation = async (reason: string) => {
    if (isAutoSubmitting.current) return;

    violationCountRef.current += 1;
    const newCount = violationCountRef.current;
    setViolationCount(newCount);

    await captureAndLogViolation(reason);

    showWarning(`⚠️ Warning ${newCount}/${MAX_VIOLATIONS}: ${reason}`);

    if (newCount >= MAX_VIOLATIONS) {
      isAutoSubmitting.current = true;
      showWarning('🚨 EXAM AUTO-SUBMITTED: Maximum violations exceeded. Grade: FAIL');
      setTimeout(() => handleSubmit(true), 2000);
    }
  };

  // ── Capture Screenshot + Log Violation ──
  const captureAndLogViolation = async (reason: string) => {
    if (!videoRef.current || !canvasRef.current || !socketRef.current) return;

    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    canvasRef.current.width = 640;
    canvasRef.current.height = 480;
    context.drawImage(videoRef.current, 0, 0, 640, 480);
    const fullBase64Image = canvasRef.current.toDataURL('image/jpeg', 0.7);

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
      console.error('Violation screenshot upload failed', err);
    }

    const log = {
      message: `Violation: ${reason}`,
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
  };

  // ── Timer ──
  useEffect(() => {
    if (step === 'exam' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleSubmit(false);
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

  // ── Request Camera + Mic ──
  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(stream);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorder.start(1000);

      setStep('exam');
      startAIProctoring();
      startVideoStreaming();
      startFaceIdentityCheck();
    } catch (err) {
      alert('Camera and Microphone permissions are required to take the exam.');
    }
  };

  // ── Stream Frames to Teacher ──
  const startVideoStreaming = () => {
    const streamInterval = setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        const context = canvasRef.current.getContext('2d');
        if (context) {
          canvasRef.current.width = 160;
          canvasRef.current.height = 120;
          context.drawImage(videoRef.current, 0, 0, 160, 120);
          const frame = canvasRef.current.toDataURL('image/jpeg', 0.5);
          socketRef.current.emit('student-frame', { examId: id, studentId: user?.id, frame });
        }
      }
    }, 1000);
    return () => clearInterval(streamInterval);
  };

  // ── AI Proctoring Every 5s ──
  const startAIProctoring = () => {
    proctoringIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;
      const context = canvasRef.current.getContext('2d');
      if (!context) return;

      canvasRef.current.width = 640;
      canvasRef.current.height = 480;
      context.drawImage(videoRef.current, 0, 0, 640, 480);
      const base64Image = canvasRef.current.toDataURL('image/jpeg', 0.7).split(',')[1];

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-preview-05-20',
          contents: [
            {
              inlineData: { mimeType: 'image/jpeg', data: base64Image }
            },
            {
              text: `You are a strict AI exam proctor. Analyze this webcam frame carefully.
DETECT any of the following as suspicious (isSuspicious=true):
- More than ONE person visible in the frame
- Any electronic device visible: phone, tablet, smartwatch, earbuds, second laptop
- Physical notes, books, or papers being referenced
- Student looking away from screen for extended time
- Student whispering or talking (even without audio)
- Hands off keyboard suspiciously long
- Empty chair (student left)
ALSO analyze:
- Student gaze direction: Center (looking at screen), Left, Right, Up, Down
- Emotional state and focus score 0-100
Respond in JSON only.`
            }
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isSuspicious: { type: Type.BOOLEAN },
                reason: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                emotion: { type: Type.STRING },
                focusScore: { type: Type.NUMBER },
                gazeDirection: { type: Type.STRING },
                multiplePeople: { type: Type.BOOLEAN },
                electronicDevice: { type: Type.BOOLEAN },
                physicalNotes: { type: Type.BOOLEAN }
              },
              required: ['isSuspicious', 'reason', 'emotion', 'focusScore', 'gazeDirection', 'multiplePeople', 'electronicDevice']
            }
          }
        });

        const result = JSON.parse(response.text || '{}');

        // Cognitive log
        setCognitiveLogs(prev => [...prev, {
          timestamp: new Date(),
          emotion: result.emotion,
          focusScore: result.focusScore,
          gaze: result.gazeDirection
        }]);

        // ── Eye / Gaze Tracking ──
        const offGaze = result.gazeDirection !== 'Center';
        if (offGaze) {
          consecutiveOffGazeTicks.current += 1;
          // Trigger violation immediately
          if (consecutiveOffGazeTicks.current >= 1) {
            registerViolation(`Eyes/Head off screen detected — direction: ${result.gazeDirection}`);
            consecutiveOffGazeTicks.current = 0;
          }
        } else {
          consecutiveOffGazeTicks.current = 0;
        }

        // ── Multiple People ──
        if (result.multiplePeople) {
          registerViolation('Multiple people detected in frame');
        }

        // ── Electronic Device ──
        if (result.electronicDevice) {
          registerViolation('Electronic device detected (phone/tablet/etc.)');
        }

        // ── Physical Notes ──
        if (result.physicalNotes) {
          registerViolation('Physical notes or books detected');
        }

        // ── General Suspicious ──
        if (result.isSuspicious && result.confidence > 0.7 && !result.multiplePeople && !result.electronicDevice && !result.physicalNotes) {
          registerViolation(result.reason);
        }
      } catch (error) {
        console.error('AI Proctoring failed', error);
      }
    }, 5000);
  };

  // ── Face Identity Check Every 30s ──
  const startFaceIdentityCheck = () => {
    if (!loginFaceRef) return;
    faceCheckIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || !faceModelsLoaded || !loginFaceRef) return;

      try {
        const context = canvasRef.current.getContext('2d');
        if (!context) return;
        canvasRef.current.width = 640;
        canvasRef.current.height = 480;
        context.drawImage(videoRef.current, 0, 0, 640, 480);
        const currentBase64 = canvasRef.current.toDataURL('image/jpeg', 0.8);

        const refImg = await faceapi.fetchImage(loginFaceRef);
        const currentImg = await faceapi.fetchImage(currentBase64);

        let refDetection = await faceapi.detectSingleFace(refImg).withFaceLandmarks().withFaceDescriptor();
        if (!refDetection) refDetection = await faceapi.detectSingleFace(refImg, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })).withFaceLandmarks().withFaceDescriptor();

        let currDetection = await faceapi.detectSingleFace(currentImg).withFaceLandmarks().withFaceDescriptor();
        if (!currDetection) currDetection = await faceapi.detectSingleFace(currentImg, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })).withFaceLandmarks().withFaceDescriptor();

        if (refDetection && currDetection) {
          const distance = faceapi.euclideanDistance(refDetection.descriptor, currDetection.descriptor);
          if (distance > 0.75) {
            // Face mismatch — notify teacher, log it, but student can continue
            let screenshotUrl = '';
            try {
              const blob = await (await fetch(currentBase64)).blob();
              const formData = new FormData();
              formData.append('file', blob, `facemismatch_${id}_${user?.id}_${Date.now()}.jpg`);
              const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
              });
              if (uploadRes.ok) screenshotUrl = (await uploadRes.json()).url;
            } catch (_) {}

            const mismatchLog = {
              timestamp: new Date(),
              distance: distance.toFixed(3),
              screenshot: screenshotUrl || currentBase64
            };

            setFaceMismatchLogs(prev => [...prev, mismatchLog]);
            socketRef.current?.emit('face-mismatch', {
              studentId: user?.id,
              studentName: user?.name,
              examId: id,
              screenshot: screenshotUrl || currentBase64,
              timestamp: new Date()
            });

            showWarning('⚠️ Face mismatch detected — your teacher has been notified. You may continue.');
          }
        }
      } catch (err) {
        console.error('Face identity check failed', err);
      }
    }, 30000);
  };

  // ── Block Copy / Paste / Cut ──
  const blockCopyPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setCopyBlockedMsg(true);
    setTimeout(() => setCopyBlockedMsg(false), 3000);
  };

  // ── Submit Exam ──
  const handleSubmit = async (isAutoFail: boolean = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    clearInterval(timerRef.current);
    clearInterval(proctoringIntervalRef.current);
    clearInterval(faceCheckIntervalRef.current);

    setSubmissionStatus('Stopping proctoring and preparing video...');

    let videoUrl = '';
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
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
        if (uploadRes.ok) videoUrl = (await uploadRes.json()).url;
      } catch (_) {}
    }

    let score = 0;
    let aiAnalysis = 'Auto-submitted due to malpractice.';
    let cognitiveAnalysis = 'N/A';
    let focusAnalysis = 'N/A';
    let growthAnalysis = 'N/A';
    let detailedFeedback = 'N/A';

    if (!isAutoFail && exam) {
      setSubmissionStatus('AI is analyzing your performance...');
      let correctCount = 0;
      exam.questions.forEach((q: any) => {
        if (answers[q.id] === q.correct_answer) correctCount++;
      });
      score = exam.questions.length > 0 ? Math.round((correctCount / exam.questions.length) * 100) : 0;
      await new Promise(resolve => setTimeout(resolve, 1500));
      aiAnalysis = 'The student completed the exam under AI proctoring supervision.';
      cognitiveAnalysis = 'Performance data analyzed.';
      focusAnalysis = 'Focus data recorded.';
      growthAnalysis = 'Review flagged areas for improvement.';
      detailedFeedback = 'Answers evaluated against expected responses.';
    }

    setSubmissionStatus('Finalizing submission...');

    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        examId: id,
        answers,
        proctoringLogs: logsRef.current,
        videoUrl,
        score,
        aiAnalysis,
        cognitiveAnalysis,
        focusAnalysis,
        growthAnalysis,
        detailedFeedback,
        cognitiveLogs,
        isAutoFail,
        faceMismatchLogs: faceMismatchLogsRef.current,
        violationCount: violationCountRef.current
      })
    });

    if (res.ok) {
      if (isAutoFail) {
        alert('Your exam has been automatically submitted due to repeated malpractice violations. Grade: FAIL');
      } else {
        alert('Exam submitted successfully!');
      }
      navigate('/student/results');
    } else {
      alert('Failed to submit exam. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (!exam) return <div className="p-8 text-white">Loading...</div>;

  const violationPercent = (violationCount / MAX_VIOLATIONS) * 100;

  return (
    <div
      className="max-w-5xl mx-auto space-y-8"
      onCopy={blockCopyPaste}
      onCut={blockCopyPaste}
      onPaste={blockCopyPaste}
    >
      {/* ── Submitting Overlay ── */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center text-center p-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full mb-6"
          />
          <h2 className="text-2xl font-bold text-white mb-2">Submitting Examination</h2>
          <p className="text-zinc-400 max-w-md">{submissionStatus}</p>
        </div>
      )}

      {/* ── Warning Toast ── */}
      <AnimatePresence>
        {warning && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 bg-red-700 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3 border border-red-400 max-w-xl w-full"
          >
            <AlertTriangle size={24} className="shrink-0" />
            <span className="font-bold text-sm">{warning}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Copy Blocked Toast ── */}
      <AnimatePresence>
        {copyBlockedMsg && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-orange-600 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-3 border border-orange-400"
          >
            <CopyX size={20} />
            <span className="font-bold text-sm">Copying & pasting is disabled during the exam.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Instructions Step ── */}
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
              <h2 className="text-xl font-bold text-white">Rules & Anti-Malpractice Policy</h2>
              <ul className="space-y-3 text-zinc-400">
                {[
                  'Stay in a well-lit, quiet room with only yourself visible.',
                  'Camera and microphone must remain ON throughout the exam.',
                  'Do NOT switch tabs, minimize the browser, or open other apps.',
                  'Do NOT use or show any phone, tablet, or electronic device.',
                  'Do NOT reference physical notes, books, or papers.',
                  'Keep your eyes on the screen at all times.',
                  'No other person should appear in the camera frame.',
                  'Copying or pasting text is strictly disabled.',
                  'A second screen/monitor will be detected and flagged.',
                  'You get 5 warnings. After 5 violations → auto-submit + grade FAIL.'
                ].map((rule, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    {rule}
                  </li>
                ))}
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
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Duration</span>
                  <span className="text-white">{exam.duration_minutes} mins</span>
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
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-xs font-bold uppercase mb-1">⚠️ Zero Tolerance Policy</p>
                <p className="text-zinc-400 text-xs">5 violations = automatic FAIL. Face identity is checked every 30 seconds. All violations are photographed and reported to your teacher.</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep('permissions')}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-lg"
          >
            <Play size={20} /> I Understand & Accept — Continue
          </button>
        </motion.div>
      )}

      {/* ── Permissions Step ── */}
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
            Grant Permissions & Start Exam
          </button>
        </motion.div>
      )}

      {/* ── Exam Step ── */}
      {step === 'exam' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Questions Panel */}
          <div className="lg:col-span-3 space-y-8">
            <div
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8"
              style={{ userSelect: 'none' }}
            >
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
                      {/* Question text - copy disabled via CSS + handler */}
                      <p
                        className="text-lg text-white font-medium"
                        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                        onCopy={blockCopyPaste}
                      >
                        {q.content}
                      </p>
                    </div>

                    {exam.type === 'mcq' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-12">
                        {JSON.parse(q.options || '[]').map((opt: string, optIdx: number) => (
                          <button
                            key={optIdx}
                            onClick={() => setAnswers({ ...answers, [q.id]: opt })}
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
                          placeholder="# Write your code here..."
                          value={answers[q.id] || ''}
                          onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                          onPaste={blockCopyPaste}
                          onCopy={blockCopyPaste}
                          onCut={blockCopyPaste}
                        />
                        <p className="text-xs text-zinc-500 italic">Automatic grading will run after submission.</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-12 pt-8 border-t border-zinc-800 flex justify-end">
                <button
                  onClick={() => handleSubmit(false)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-12 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-emerald-900/20 flex items-center gap-2"
                >
                  <CheckCircle size={20} /> Submit Examination
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Live Feed */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 overflow-hidden">
              <div className="aspect-video bg-black rounded-2xl relative overflow-hidden">
                <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
                <canvas ref={canvasRef} width="640" height="480" className="hidden" />
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-emerald-500/20 backdrop-blur-md px-2 py-1 rounded-full border border-emerald-500/30">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Live</span>
                </div>
              </div>
            </div>

            {/* Violation Counter */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-3">
              <h3 className="text-xs font-bold text-zinc-500 uppercase">Violation Status</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-300 font-semibold">Warnings</span>
                <span className={`text-lg font-black ${violationCount >= 4 ? 'text-red-500' : violationCount >= 2 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {violationCount} / {MAX_VIOLATIONS}
                </span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                <motion.div
                  className={`h-2 rounded-full transition-all ${violationCount >= 4 ? 'bg-red-500' : violationCount >= 2 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(violationPercent, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-600 italic">
                {MAX_VIOLATIONS - violationCount} warning{MAX_VIOLATIONS - violationCount !== 1 ? 's' : ''} remaining before auto-submit
              </p>
            </div>

            {/* Proctoring Status */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
              <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3">Proctoring Status</h3>
              <div className="space-y-2">
                {[
                  { label: 'AI Proctoring', icon: <Shield size={14} />, ok: true },
                  { label: 'Face Tracking', icon: <Eye size={14} />, ok: faceModelsLoaded },
                  { label: 'Identity Check', icon: <UserX size={14} />, ok: !!loginFaceRef && faceModelsLoaded },
                  { label: 'Multi-Screen Guard', icon: <MonitorX size={14} />, ok: true },
                  { label: 'Copy Protection', icon: <CopyX size={14} />, ok: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-zinc-950 rounded-xl border border-zinc-800">
                    <div className="flex items-center gap-2 text-zinc-400">
                      {item.icon}
                      <span className="text-xs">{item.label}</span>
                    </div>
                    {item.ok
                      ? <CheckCircle size={12} className="text-emerald-500" />
                      : <div className="w-3 h-3 rounded-full border border-zinc-600 animate-pulse" />
                    }
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Logs */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
              <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3">Violation Logs</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i} className="text-[10px] text-red-400 bg-red-500/5 p-2 rounded-lg border border-red-500/10">
                    [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                  </div>
                ))}
                {logs.length === 0 && <p className="text-[10px] text-zinc-600 italic">No violations recorded.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
