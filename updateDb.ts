import db from './server/db.ts';

const mockResult = {
  score: 88,
  general_feedback: "The student demonstrates a solid understanding of the core concepts but occasionally struggles with syntax in edge cases.",
  cognitive: "Strong logical reasoning and problem-solving skills. The student breaks down complex problems effectively but shows minor gaps in abstract theoretical knowledge.",
  focus: "High sustained attention. Proctoring logs indicate minimal distractions and consistent engagement with the exam material.",
  growth: "Focus on reviewing advanced data structures and practicing edge-case handling in algorithms.",
  detailed_feedback: "Question 1: Correct. Your logic was sound.\n\nQuestion 2: Good effort, but the implementation lacked boundary checks. Apt Answer: Ensure to check for null constraints before processing the array."
};

console.log("Updating submissions...");

const stmt = db.prepare(`
  UPDATE submissions 
  SET score = ?, 
      ai_analysis = ?, 
      cognitive_analysis = ?, 
      focus_analysis = ?, 
      growth_analysis = ?, 
      detailed_feedback = ?
  WHERE ai_analysis = 'Analysis pending...' OR ai_analysis = 'No analysis available.'
`);

const info = stmt.run(
  mockResult.score,
  mockResult.general_feedback,
  mockResult.cognitive,
  mockResult.focus,
  mockResult.growth,
  mockResult.detailed_feedback
);

console.log(`Updated ${info.changes} submissions.`);
