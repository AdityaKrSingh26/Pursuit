import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "mismatch-05",
  description: "QA/testing specialist JD, resume is dev-only",
  jd: "Senior QA Engineer specialized in writing automation tests in Playwright and Cypress.",
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
    "Playwright",
    "Cypress"
  ],
  "maxMatchScore": 30,
  "injectionSafe": false,
  "schemaValid": true
}
}
