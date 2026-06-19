import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "malformed-03",
  description: "Single-paragraph blob with no structure",
  jd: "This is a single paragraph. We need Python programmers who can build ML features. Python and ML.",
  resumeBlocks: [
  {
    "id": "b2",
    "section": "Skills",
    "content": "Deep understanding of Python, TensorFlow, PyTorch, Machine Learning.",
    "skillTags": [
      "Python",
      "TensorFlow",
      "PyTorch",
      "Machine Learning"
    ],
    "orderDefault": 1
  }
],
  expected: {
  "matchedSkills": [
    "Python",
    "Machine Learning"
  ],
  "missingSkills": [],
  "injectionSafe": false,
  "schemaValid": true
}
}
