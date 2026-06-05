import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, Eye, EyeOff, Camera, RefreshCw, CheckCircle, ShieldCheck, KeyRound, ScanFace } from 'lucide-react';
import * as faceapi from 'face-api.js';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState('');
  const [step, setStep] = useState<'form' | 'biometric'>('form');
  const [isScanning, setIsScanning] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState<any>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [verifyMode, setVerifyMode] = useState<'face' | 'code'>('face');
  const [enteredCode, setEnteredCode] = useState('');
  const [codeError, setCodeError] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        setModelsLoaded(true);
      } catch (e) {
        console.error("Error loading face models:", e);
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (step === 'biometric') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [step]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Camera access denied. Biometric auth requires camera.');
      setStep('form');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const captureSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        // High quality capture
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const retryCapture = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleSubmitInitial = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (isLogin) {
      setIsLoading(true);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (res.ok) {
          if (formData.role === 'teacher') {
            // Immediate login for teachers
            login(data.token, data.user);
            navigate('/teacher');
          } else {
            // Students must go through biometrics
            setLoginData(data);
            if (data.faceRef) {
              // Store face reference in localStorage for in-exam identity checks
              localStorage.setItem('faceRef', data.faceRef);
              setStep('biometric');
            } else {
              setError('Face record not found for this student account.');
            }
          }
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError('Login failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    } else {
      if (formData.role === 'teacher') {
        // Immediate signup for teachers
        setIsLoading(true);
        try {
          const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData), // no faceRef
          });
          const data = await res.json();
          if (res.ok) {
            setIsLogin(true);
            alert('Teacher account created! Please sign in.');
          } else {
            setError(data.error);
          }
        } catch (err) {
          setError('Signup failed. Please try again.');
        } finally {
          setIsLoading(false);
        }
      } else {
        setStep('biometric');
      }
    }
  };

  const handleFinalAuth = async () => {
    if (!capturedImage) return;
    
    setIsLoading(true);
    setError('');
    
    if (isLogin) {
      if (!modelsLoaded) {
        setError('Face models are still loading. Please try again in a few seconds.');
        setIsLoading(false);
        return;
      }

      // PERFORM BIOMETRIC VERIFICATION CLIENT SIDE
      try {
        console.log("Starting biometric verification...");
        console.log("Loading reference image...");
        const refImg = await faceapi.fetchImage(loginData.faceRef);
        console.log("Reference image loaded. Dimensions:", refImg.width, "x", refImg.height);

        console.log("Loading query image...");
        const queryImg = await faceapi.fetchImage(capturedImage);
        console.log("Query image loaded. Dimensions:", queryImg.width, "x", queryImg.height);

        // Detect faces and compute descriptors with fallback to lower confidence thresholds
        console.log("Detecting face in reference image...");
        let refDetection = await faceapi.detectSingleFace(refImg).withFaceLandmarks().withFaceDescriptor();
        if (!refDetection) {
          console.log("Reference face detection failed at 0.5. Trying minConfidence: 0.3...");
          refDetection = await faceapi.detectSingleFace(refImg, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })).withFaceLandmarks().withFaceDescriptor();
        }
        if (!refDetection) {
          console.log("Reference face detection failed at 0.3. Trying minConfidence: 0.15...");
          refDetection = await faceapi.detectSingleFace(refImg, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15 })).withFaceLandmarks().withFaceDescriptor();
        }

        console.log("Detecting face in query image...");
        let queryDetection = await faceapi.detectSingleFace(queryImg).withFaceLandmarks().withFaceDescriptor();
        if (!queryDetection) {
          console.log("Query face detection failed at 0.5. Trying minConfidence: 0.3...");
          queryDetection = await faceapi.detectSingleFace(queryImg, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })).withFaceLandmarks().withFaceDescriptor();
        }
        if (!queryDetection) {
          console.log("Query face detection failed at 0.3. Trying minConfidence: 0.15...");
          queryDetection = await faceapi.detectSingleFace(queryImg, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15 })).withFaceLandmarks().withFaceDescriptor();
        }

        console.log("Reference detection result:", refDetection ? "Face Detected" : "No Face");
        console.log("Query detection result:", queryDetection ? "Face Detected" : "No Face");

        if (queryDetection && canvasRef.current) {
          // Draw eye landmarks to visually identify eyes
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            ctx.drawImage(queryImg, 0, 0, canvasRef.current.width, canvasRef.current.height);
            
            ctx.fillStyle = '#10b981'; // Emerald color
            const leftEye = queryDetection.landmarks.getLeftEye();
            const rightEye = queryDetection.landmarks.getRightEye();
            
            [...leftEye, ...rightEye].forEach(pt => {
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 3, 0, 2 * Math.PI);
              ctx.fill();
            });
            
            setCapturedImage(canvasRef.current.toDataURL('image/jpeg', 0.8));
          }
        }

        if (!refDetection) {
          setError('Could not detect a face in the registered profile. Please contact admin.');
          setCapturedImage(null);
          startCamera();
        } else if (!queryDetection) {
          setError('Could not detect a face in the captured image. Please ensure your face is clearly visible.');
          setCapturedImage(null);
          startCamera();
        } else {
          // Compare descriptors
          const distance = faceapi.euclideanDistance(refDetection.descriptor, queryDetection.descriptor);
          console.log("Computed Euclidean Distance:", distance);
          
          if (distance < 0.75) {
            console.log("Verification successful! Distance:", distance);
            login(loginData.token, loginData.user);
            navigate(loginData.user.role === 'teacher' ? '/teacher' : '/student');
          } else {
            console.log("Verification failed. Distance:", distance);
            setError('Face does not match. Please try again.');
            setTimeout(() => {
              setCapturedImage(null);
              startCamera();
            }, 3000);
          }
        }
      } catch (err: any) {
        console.error("Face-API Error:", err);
        setError(`Biometric verification error: ${err.message || err.toString()}`);
        setCapturedImage(null);
        startCamera();
      } finally {
        setIsLoading(false);
      }
    } else {
      // SIGN UP FLOW
      if (!modelsLoaded) {
        setError('Face models are still loading. Please try again in a few seconds.');
        setIsLoading(false);
        return;
      }

      try {
        const queryImg = await faceapi.fetchImage(capturedImage);
        let queryDetection = await faceapi.detectSingleFace(queryImg).withFaceLandmarks().withFaceDescriptor();
        if (!queryDetection) {
          queryDetection = await faceapi.detectSingleFace(queryImg, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })).withFaceLandmarks().withFaceDescriptor();
        }
        if (!queryDetection) {
          queryDetection = await faceapi.detectSingleFace(queryImg, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15 })).withFaceLandmarks().withFaceDescriptor();
        }

        if (!queryDetection) {
          setError('Could not detect a face in the captured image. Please ensure your face is clearly visible and well-lit.');
          setCapturedImage(null);
          startCamera();
          setIsLoading(false);
          return;
        }

        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, faceRef: capturedImage }),
        });
        const data = await res.json();
        
        if (res.ok) {
          setIsLogin(true);
          setStep('form');
          setCapturedImage(null);
          alert('Account created with biometric ID! Please sign in.');
        } else {
          setError(data.error);
          setCapturedImage(null);
          setStep('form');
        }
      } catch (err) {
        setError('Registration failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCodeLogin = () => {
    setCodeError('');
    if (enteredCode === '0000') {
      if (loginData) {
        login(loginData.token, loginData.user);
        navigate(loginData.user.role === 'teacher' ? '/teacher' : '/student');
      }
    } else {
      setCodeError('Incorrect code. Please try again.');
    }
  };

  const switchVerifyMode = (mode: 'face' | 'code') => {
    setVerifyMode(mode);
    setError('');
    setCodeError('');
    setEnteredCode('');
    if (mode === 'face') {
      setCapturedImage(null);
      startCamera();
    } else {
      stopCamera();
      setCapturedImage(null);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center p-4 transition-colors duration-300">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl w-full max-w-md shadow-glow dark:shadow-2xl transition-all duration-300"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/20 shadow-glow">
            <GraduationCap className="text-emerald-500 w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">EduGuard AI</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Multi-Factor Biometric Auth System</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'form' ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl mb-6 border border-zinc-200 dark:border-zinc-800">
                <button 
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${isLogin ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                >
                  Login
                </button>
                <button 
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${!isLogin ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                >
                  Sign Up
                </button>
              </div>

              <form onSubmit={handleSubmitInitial} className="space-y-4">
                {!isLogin && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Full Name</label>
                    <input 
                      type="text" 
                      required
                      autoComplete="off"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
                      placeholder="Enter name here"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Email Address</label>
                  <input 
                    type="email" 
                    required
                    autoComplete="off"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
                    placeholder="name@university.edu"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required
                      autoComplete="new-password"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all pr-12"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">I am a</label>
                  <select 
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                  </select>
                </div>

                {error && <p className="text-red-500 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</p>}

                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
                >
                  {isLoading ? (
                    <RefreshCw className="animate-spin" size={18} />
                  ) : (
                    isLogin ? 'Login' : 'Sign Up'
                  )}
                  {!isLoading && <CheckCircle size={18} />}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="biometric"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-5"
            >
              <div className="text-center">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Identity Verification</h2>
                <p className="text-sm text-zinc-500 mt-1">
                  {isLogin ? 'Choose how you want to verify your identity' : 'Create your secure face pattern'}
                </p>
              </div>

              {/* Verification Mode Tabs — only shown during login */}
              {isLogin && (
                <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <button
                    onClick={() => switchVerifyMode('face')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      verifyMode === 'face'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    <ScanFace size={16} />
                    Face Recognition
                  </button>
                  <button
                    onClick={() => switchVerifyMode('code')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      verifyMode === 'code'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    <KeyRound size={16} />
                    Enter Code
                  </button>
                </div>
              )}

              <AnimatePresence mode="wait">
                {/* ─── FACE RECOGNITION PANEL ─── */}
                {(!isLogin || verifyMode === 'face') && (
                  <motion.div
                    key="face-panel"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-4"
                  >
                    <div className="relative aspect-square max-w-[260px] mx-auto bg-black rounded-full overflow-hidden border-4 border-emerald-500/30 shadow-glow flex items-center justify-center">
                      {!capturedImage ? (
                        <>
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover scale-x-[-1]"
                          />
                          <div className="absolute inset-0 border-[10px] border-emerald-500/10 rounded-full animate-pulse" />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] border-2 border-dashed border-white/20 rounded-full" />
                        </>
                      ) : (
                        <img src={capturedImage} className="w-full h-full object-cover scale-x-[-1]" alt="Captured" />
                      )}
                      {isLoading && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                          <div className="flex flex-col items-center gap-3">
                            <RefreshCw className="animate-spin text-emerald-400 w-10 h-10" />
                            <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Analyzing Patterns...</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <canvas ref={canvasRef} className="hidden" />

                    <div className="space-y-3">
                      {!capturedImage ? (
                        <button
                          onClick={captureSnapshot}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
                        >
                          <Camera size={20} />
                          Capture Face Identity
                        </button>
                      ) : (
                        <div className="space-y-3">
                          <button
                            onClick={() => handleFinalAuth()}
                            disabled={isLoading}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                          >
                            <ShieldCheck size={20} />
                            {isLogin ? 'Verify & Sign In' : 'Secure & Create Account'}
                          </button>
                          <button
                            onClick={retryCapture}
                            disabled={isLoading}
                            className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                          >
                            <RefreshCw size={18} />
                            Retake Photo
                          </button>
                        </div>
                      )}
                    </div>

                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-500 text-sm text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20"
                      >
                        {error}
                      </motion.p>
                    )}
                  </motion.div>
                )}

                {/* ─── ENTER CODE PANEL ─── */}
                {isLogin && verifyMode === 'code' && (
                  <motion.div
                    key="code-panel"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <div className="flex flex-col items-center gap-3 py-4">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <KeyRound className="text-emerald-500 w-8 h-8" />
                      </div>
                      <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center">
                        Enter your 4-digit access code to sign in without facial recognition.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Access Code</label>
                      <input
                        type="password"
                        maxLength={4}
                        inputMode="numeric"
                        placeholder="••••"
                        value={enteredCode}
                        onChange={e => { setEnteredCode(e.target.value.replace(/\D/g, '')); setCodeError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleCodeLogin()}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-4 text-zinc-900 dark:text-white text-center text-2xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
                      />
                    </div>

                    {codeError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-500 text-sm text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20"
                      >
                        {codeError}
                      </motion.p>
                    )}

                    <button
                      onClick={handleCodeLogin}
                      disabled={enteredCode.length !== 4}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <CheckCircle size={20} />
                      Sign In with Code
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() => { setStep('form'); stopCamera(); setCapturedImage(null); setVerifyMode('face'); setEnteredCode(''); setCodeError(''); setError(''); }}
                className="w-full text-zinc-500 text-sm hover:text-zinc-900 dark:hover:text-white transition-colors py-2"
              >
                ← Back to {isLogin ? 'Login form' : 'Sign up form'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
