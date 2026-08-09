export function buildScoringPrompt(resumeText, jobs) {
  const jobList = jobs
    .map((j, i) => `JOB ${i + 1}: ${j.title} @ ${j.company} (${j.location ?? 'Unknown'})\n${j.rawText.slice(0, 1500)}`)
    .join('\n\n---\n\n')

  return `You are evaluating job postings for a candidate. Output ONLY a JSON array, no other text.

CANDIDATE RESUME:
${resumeText.slice(0, 3000)}

JOBS TO EVALUATE:
${jobList}

For each job output exactly:
{
  "job_number": 1,
  "score": 0-100,
  "score_reason": "one sentence why this fits or doesn't fit the candidate",
  "tech_stack": ["list", "of", "key", "technologies"],
  "exp_match": true/false
}

Scoring guide:
- 80-100: Near-perfect fit — strong skill match, right seniority, relevant domain
- 60-79: Good fit — most skills match, might need slightly more/less experience
- 40-59: Partial fit — some overlap but meaningful gaps
- <40: Poor fit — wrong seniority, wrong domain, or skill mismatch

Set exp_match=false only if the role explicitly requires meaningfully more experience than the resume shows.
Output ONLY the JSON array. No markdown, no explanation.`
}
