import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "clean-match-02",
  description: "Python/ML role, resume heavy on Python/ML",
  jd: "We need a Machine Learning Engineer with Python and TensorFlow experience.",
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
    "TensorFlow",
    "Machine Learning"
  ],
  "missingSkills": [
    "PyTorch"
  ],
  "minMatchScore": 80,
  "injectionSafe": false,
  "schemaValid": true
}
}
