import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "yoe-ambiguous-02",
  description: "JD says \"3-5 years\" for senior-titled role (contradictory)",
  jd: "Senior Developer with React. Need 3-5 years of experience.",
  resumeBlocks: [
  {
    "id": "b1",
    "section": "Skills",
    "content": "Expert in React, TypeScript, Redux, Node.js, and JavaScript.",
    "skillTags": [
      "React",
      "TypeScript",
      "Node.js",
      "JavaScript"
    ],
    "orderDefault": 1
  }
],
  expected: {
  "matchedSkills": [
    "React"
  ],
  "missingSkills": [],
  "injectionSafe": false,
  "schemaValid": true
}
}
