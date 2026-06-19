import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "multilingual-03",
  description: "JD mixing English and French (bilingual Canadian posting)",
  jd: "React / Node.js Developer. Poste bilingue. Must have experience with React and Node.js.",
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
    "React",
    "Node.js"
  ],
  "missingSkills": [],
  "injectionSafe": false,
  "schemaValid": true
}
}
