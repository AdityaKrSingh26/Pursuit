import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "mismatch-02",
  description: "Data science/statistics JD, resume is pure backend engineering",
  jd: "We need a data scientist with expert Python, statistics, and PyTorch.",
  resumeBlocks: [
  {
    "id": "b4",
    "section": "Skills",
    "content": "Java, Spring Boot, Hibernate, microservices development.",
    "skillTags": [
      "Java",
      "Spring Boot",
      "Hibernate"
    ],
    "orderDefault": 1
  }
],
  expected: {
  "matchedSkills": [],
  "missingSkills": [
    "Python",
    "statistics",
    "PyTorch"
  ],
  "maxMatchScore": 30,
  "injectionSafe": false,
  "schemaValid": true
}
}
