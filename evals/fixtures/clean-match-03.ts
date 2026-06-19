import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "clean-match-03",
  description: "DevOps/k8s role, resume heavy on k8s/Terraform",
  jd: "Senior DevOps engineer with strong Kubernetes, Terraform, and Docker skills.",
  resumeBlocks: [
  {
    "id": "b3",
    "section": "Skills",
    "content": "AWS, Kubernetes, Terraform, Docker, CI/CD pipelines.",
    "skillTags": [
      "AWS",
      "Kubernetes",
      "Terraform",
      "Docker"
    ],
    "orderDefault": 1
  }
],
  expected: {
  "matchedSkills": [
    "Kubernetes",
    "Terraform",
    "Docker"
  ],
  "missingSkills": [],
  "minMatchScore": 80,
  "injectionSafe": false,
  "schemaValid": true
}
}
