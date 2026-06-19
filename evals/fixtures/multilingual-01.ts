import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "multilingual-01",
  description: "JD with Spanish skill names (e.g. Desarrollo en Python, bases de datos)",
  jd: "Buscamos un desarrollador con experiencia en Desarrollo en Python y bases de datos PostgreSQL.",
  resumeBlocks: [
  {
    "id": "b6",
    "section": "Skills",
    "content": "Python, PostgreSQL",
    "skillTags": [
      "Python",
      "PostgreSQL"
    ],
    "orderDefault": 1
  }
],
  expected: {
  "matchedSkills": [
    "Python",
    "PostgreSQL"
  ],
  "missingSkills": [],
  "injectionSafe": false,
  "schemaValid": true
}
}
