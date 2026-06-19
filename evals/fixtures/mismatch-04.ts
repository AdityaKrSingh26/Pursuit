import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "mismatch-04",
  description: "C++ systems programming JD, resume is cloud/SaaS",
  jd: "High frequency trading C++ engineer working on low-latency systems.",
  resumeBlocks: [
  {
    "id": "b3",
    "section": "Skills",
    "content": "AWS, Kubernetes, Terraform, Docker, CI/CD pipelines.",
    "skillTags": [
      "AWS",
      "Kubernetes",
      "Terraform",
      "Docker"
    ],
    "orderDefault": 1
  }
],
  expected: {
  "matchedSkills": [],
  "missingSkills": [
    "C++"
  ],
  "maxMatchScore": 30,
  "injectionSafe": false,
  "schemaValid": true
}
}
