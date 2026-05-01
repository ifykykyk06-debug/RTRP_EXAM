import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "./server/db.ts";
import path from "path";
import multer from "multer";
import fs from "fs";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage });

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  app.use(express.json());
  app.use('/uploads', express.static('uploads'));

  // --- Middleware ---
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // --- File Upload Route ---
  app.post("/api/upload", authenticate, upload.single('file'), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl, filename: req.file.originalname });
  });

  // --- Auth Routes ---
  app.post("/api/auth/signup", (req, res) => {
    const { name, email, password, role, faceRef } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const info = db.prepare("INSERT INTO users (name, email, password, role, face_ref) VALUES (?, ?, ?, ?, ?)").run(name, email, hashedPassword, role, faceRef);
      res.json({ success: true, userId: info.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;

    if (user && bcrypt.compareSync(password, user.password)) {
      const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET);
      res.json({ token, user: { id: user.id, name: user.name, role: user.role }, faceRef: user.face_ref });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // --- Exam Routes ---
  app.post("/api/exams", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const { title, description, type, questions, duration_minutes } = req.body;
    const info = db.prepare("INSERT INTO exams (title, description, teacher_id, type, duration_minutes) VALUES (?, ?, ?, ?, ?)").run(title, description, req.user.id, type, duration_minutes || 60);
    const examId = info.lastInsertRowid;

    const stmt = db.prepare("INSERT INTO questions (exam_id, content, options, correct_answer, test_cases) VALUES (?, ?, ?, ?, ?)");
    for (const q of questions) {
      stmt.run(examId, q.content, JSON.stringify(q.options), q.correct_answer, JSON.stringify(q.test_cases));
    }
    res.json({ success: true, examId });
  });

  app.get("/api/exams", authenticate, (req: any, res) => {
    let exams;
    if (req.user.role === 'student') {
      exams = db.prepare(`
        SELECT e.*, 
        (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id AND s.student_id = ?) as has_submitted
        FROM exams e
      `).all(req.user.id);
    } else {
      exams = db.prepare("SELECT * FROM exams").all();
    }
    res.json(exams);
  });

  app.get("/api/exams/:id", authenticate, (req, res) => {
    const exam = db.prepare("SELECT * FROM exams WHERE id = ?").get(req.params.id);
    const questions = db.prepare("SELECT * FROM questions WHERE exam_id = ?").all(req.params.id);
    res.json({ ...exam, questions });
  });

  app.post("/api/submissions", authenticate, async (req: any, res) => {
    const {
      examId,
      answers,
      proctoringLogs,
      videoUrl,
      score,
      aiAnalysis,
      cognitiveAnalysis,
      focusAnalysis,
      growthAnalysis,
      detailedFeedback
    } = req.body;

    // Check if submission already exists
    const existing = db.prepare("SELECT id FROM submissions WHERE exam_id = ? AND student_id = ?").get(examId, req.user.id);
    if (existing) {
      return res.status(400).json({ error: "You have already submitted this exam." });
    }

    db.prepare("INSERT INTO submissions (exam_id, student_id, answers, proctoring_logs, ai_analysis, cognitive_analysis, focus_analysis, growth_analysis, detailed_feedback, video_url, score, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        examId,
        req.user.id,
        JSON.stringify(answers),
        JSON.stringify(proctoringLogs),
        aiAnalysis || "No analysis available.",
        cognitiveAnalysis || "No analysis available.",
        focusAnalysis || "No analysis available.",
        growthAnalysis || "No analysis available.",
        detailedFeedback || "No detailed feedback available.",
        videoUrl,
        score || 0,
        'approved'
      );
    res.json({ success: true });
  });

  app.post("/api/exams/:id/release-results", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    db.prepare("UPDATE exams SET results_released = 1 WHERE id = ? AND teacher_id = ?").run(req.params.id, req.user.id);
    res.json({ success: true });
  });

  app.get("/api/submissions/student", authenticate, (req: any, res) => {
    const submissions = db.prepare(`
      SELECT s.*, e.title as exam_title, e.results_released
      FROM submissions s 
      JOIN exams e ON s.exam_id = e.id 
      WHERE s.student_id = ?
    `).all(req.user.id);
    res.json(submissions);
  });

  app.get("/api/submissions/teacher", authenticate, (req: any, res) => {
    const submissions = db.prepare(`
      SELECT s.*, e.title as exam_title, e.results_released, u.name as student_name 
      FROM submissions s 
      JOIN exams e ON s.exam_id = e.id 
      JOIN users u ON s.student_id = u.id
      WHERE e.teacher_id = ?
    `).all(req.user.id);
    res.json(submissions);
  });

  app.post("/api/submissions/:id/approve", authenticate, (req: any, res) => {
    const { score } = req.body;
    db.prepare("UPDATE submissions SET status = 'approved', score = ? WHERE id = ?").run(score, req.params.id);
    res.json({ success: true });
  });

  app.post("/api/exams/:id/release", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    db.prepare("UPDATE exams SET is_released = 1 WHERE id = ? AND teacher_id = ?").run(req.params.id, req.user.id);
    const exam = db.prepare("SELECT title FROM exams WHERE id = ?").get(req.params.id) as any;
    io.emit("exam-released", { title: exam.title });
    res.json({ success: true });
  });

  // --- Material Routes ---
  app.post("/api/materials", authenticate, (req: any, res) => {
    const { title, description, file_url } = req.body;
    db.prepare("INSERT INTO materials (title, description, file_url, teacher_id) VALUES (?, ?, ?, ?)")
      .run(title, description, file_url, req.user.id);
    res.json({ success: true });
  });

  app.get("/api/materials", authenticate, (req, res) => {
    const materials = db.prepare("SELECT * FROM materials").all();
    res.json(materials);
  });

  // --- Socket.io for Proctoring ---
  const activeStudents = new Map();

  io.on("connection", (socket) => {
    socket.on("join-exam", (data) => {
      const { examId, studentName, studentId, role } = data;
      if (role === 'teacher') {
        socket.join(`teacher-monitor`);
      } else {
        socket.join(`exam-${examId}`);
        activeStudents.set(socket.id, { examId, studentName, studentId });
        // Notify teachers
        io.to(`teacher-monitor`).emit("student-joined", { studentId, studentName, examId, socketId: socket.id });
      }
    });

    socket.on("student-frame", (data) => {
      // Broadcast frame to all teachers monitoring
      io.to(`teacher-monitor`).emit("teacher-frame", {
        studentId: data.studentId,
        frame: data.frame
      });
    });

    socket.on("suspicious-activity", (data) => {
      io.to(`teacher-monitor`).emit("teacher-warning", data);
      socket.emit("student-warning", "Warning: Suspicious activity detected!");
    });

    socket.on("disconnect", () => {
      const student = activeStudents.get(socket.id);
      if (student) {
        io.to(`teacher-monitor`).emit("student-left", { studentId: student.studentId });
        activeStudents.delete(socket.id);
      }
    });
  });

  // --- Vite / Static Files ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => res.sendFile(path.resolve("dist/index.html")));
  }

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
