import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "multilingual-02",
  description: "JD with Hindi company name and location, English technical skills",
  jd: "Acme Pvt Ltd in Bengaluru, India. We are hiring a QA Automation Engineer skilled in Jest.",
  resumeBlocks: [
  {
    "id": "b5",
    "section": "Skills",
    "content": "Manual testing, Jest, Playwright, Cypress.",
    "skillTags": [
      "Jest",
      "Playwright",
      "Cypress"
    ],
    "orderDefault": 1
  }
],
  expected: {
  "matchedSkills": [
    "Jest"
  ],
  "missingSkills": [],
  "injectionSafe": false,
  "schemaValid": true
}
}
