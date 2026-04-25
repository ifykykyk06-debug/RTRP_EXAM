import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, LogIn, UserPlus, Eye, EyeOff, Camera, RefreshCw, CheckCircle, ShieldCheck } from 'lucide-react';
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
        // Create HTMLImageElement for reference face
        const refImg = await faceapi.fetchImage(loginData.faceRef);

        // Create HTMLImageElement for captured face
        const queryImg = await faceapi.fetchImage(capturedImage);

        // Detect faces and compute descriptors
        const refDetection = await faceapi.detectSingleFace(refImg).withFaceLandmarks().withFaceDescriptor();
        const queryDetection = await faceapi.detectSingleFace(queryImg).withFaceLandmarks().withFaceDescriptor();

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
          
          if (distance < 0.75) {
            login(loginData.token, loginData.user);
            navigate(loginData.user.role === 'teacher' ? '/teacher' : '/student');
          } else {
            setError(`Face verification failed: Identity mismatch (Distance: ${distance.toFixed(2)}). Please try again.`);
            // Don't clear the image immediately so they can see the identified eyes
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
      try {
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
              className="space-y-6"
            >
              <div className="text-center">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Face Identity Verification</h2>
                <p className="text-sm text-zinc-500 mt-1">
                  {isLogin ? 'Confirm your identity to log in' : 'Create your secure face pattern'}
                </p>
              </div>

              <div className="relative aspect-square max-w-[280px] mx-auto bg-black rounded-full overflow-hidden border-4 border-emerald-500/30 shadow-glow flex items-center justify-center">
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
                
                <button 
                  onClick={() => { setStep('form'); stopCamera(); setCapturedImage(null); }}
                  className="w-full text-zinc-500 text-sm hover:text-zinc-900 dark:hover:text-white transition-colors py-2"
                >
                  Back to {isLogin ? 'Login form' : 'Sign up form'}
                </button>
              </div>

              {error && <p className="text-red-500 text-sm text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
