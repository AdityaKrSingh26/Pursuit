import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "yoe-ambiguous-03",
  description: "YOE not mentioned at all; infer from responsibilities",
  jd: "React developer position. Design components, coordinate with product managers.",
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
