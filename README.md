# EduGuard AI Exam System

## Setup Instructions

1. **Environment Variables**:
   Copy `.env.example` to `.env` and ensure `GEMINI_API_KEY` is set.
   
2. **Docker Setup**:
   To run locally using Docker:
   ```bash
   docker-compose up --build
   ```

3. **Manual Setup**:
   ```bash
   npm install
   npm run dev
   ```

## Features
- **AI Proctoring**: Real-time face detection and suspicious activity monitoring.
- **Teacher Dashboard**: Exam creation (MCQ/Coding), grading, and material management.
- **Student Dashboard**: Exam taking, assignment downloads, and AI-driven performance analysis.
- **Coding Environment**: Integrated Python coding editor with test cases.
