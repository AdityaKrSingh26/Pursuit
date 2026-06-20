export function buildScoringPrompt(resumeText, jobs) {
  const jobList = jobs
    .map((j, i) => `JOB ${i + 1}: ${j.title} @ ${j.company} (${j.location ?? 'Unknown'})\n${j.rawText.slice(0, 1500)}`)
    .join('\n\n---\n\n')

  return `You are evaluating job fit for a candidate based on their resume.

CANDIDATE RESUME:
${resumeText.slice(0, 3000)}

---

JOBS TO EVALUATE:
${jobList}

---

For each job, output a JSON array (one object per job, in order):
[
  {
    "job_number": 1,
    "score": 85,
    "score_reason": "one sentence explaining fit",
    "tech_stack": ["Python", "AWS", "PostgreSQL"]
  }
]

Rules:
- score is 0-100 (70+ means worth applying)
- score_reason is a single sentence, specific to this job and resume
- tech_stack lists the key technologies mentioned in the JD
- Output ONLY the JSON array, no other text`
}
