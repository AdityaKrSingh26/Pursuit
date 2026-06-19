import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "clean-match-05",
  description: "Java/Spring role, strong Java background",
  jd: "Java Developer needed for microservices. Experience with Spring Boot is key.",
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
  "matchedSkills": [
    "Java",
    "Spring Boot"
  ],
  "missingSkills": [],
  "minMatchScore": 80,
  "injectionSafe": false,
  "schemaValid": true
}
}
