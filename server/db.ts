import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.resolve('data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'database.db'));
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('teacher', 'student')) NOT NULL,
    face_ref TEXT -- Base64 or URL of the reference face
  );

  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    teacher_id INTEGER,
    type TEXT CHECK(type IN ('mcq', 'coding')) NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    is_released INTEGER DEFAULT 0,
    results_released INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(teacher_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER,
    content TEXT NOT NULL,
    options TEXT, -- JSON string for MCQ options
    correct_answer TEXT,
    test_cases TEXT, -- JSON string for coding test cases
    FOREIGN KEY(exam_id) REFERENCES exams(id)
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER,
    student_id INTEGER,
    answers TEXT, -- JSON string
    score REAL,
    status TEXT DEFAULT 'pending', -- pending, approved
    proctoring_logs TEXT, -- JSON string of suspicious activities
    ai_analysis TEXT,
    cognitive_analysis TEXT,
    focus_analysis TEXT,
    growth_analysis TEXT,
    detailed_feedback TEXT,
    video_url TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(exam_id) REFERENCES exams(id),
    FOREIGN KEY(student_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    teacher_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(teacher_id) REFERENCES users(id)
  );
`);

// Migration: Add is_released to exams if missing
try {
  db.prepare("SELECT is_released FROM exams LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE exams ADD COLUMN is_released INTEGER DEFAULT 0");
}

// Migration: Add proctoring_logs and ai_analysis to submissions if missing
try {
  db.prepare("SELECT proctoring_logs FROM submissions LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE submissions ADD COLUMN proctoring_logs TEXT");
}

try {
  db.prepare("SELECT ai_analysis FROM submissions LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE submissions ADD COLUMN ai_analysis TEXT");
}

try {
  db.prepare("SELECT results_released FROM exams LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE exams ADD COLUMN results_released INTEGER DEFAULT 0");
}

try {
  db.prepare("SELECT duration_minutes FROM exams LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE exams ADD COLUMN duration_minutes INTEGER DEFAULT 60");
}

try {
  db.prepare("SELECT cognitive_analysis FROM submissions LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE submissions ADD COLUMN cognitive_analysis TEXT");
}

try {
  db.prepare("SELECT focus_analysis FROM submissions LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE submissions ADD COLUMN focus_analysis TEXT");
}

try {
  db.prepare("SELECT growth_analysis FROM submissions LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE submissions ADD COLUMN growth_analysis TEXT");
}

try {
  db.prepare("SELECT detailed_feedback FROM submissions LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE submissions ADD COLUMN detailed_feedback TEXT");
}

try {
  db.prepare("SELECT video_url FROM submissions LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE submissions ADD COLUMN video_url TEXT");
}

try {
  db.prepare("SELECT face_ref FROM users LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE users ADD COLUMN face_ref TEXT");
}

try {
  db.prepare("SELECT cognitive_logs FROM submissions LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE submissions ADD COLUMN cognitive_logs TEXT");
}

export default db;
