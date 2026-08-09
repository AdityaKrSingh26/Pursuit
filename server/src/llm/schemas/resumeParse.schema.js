import { z } from 'zod'

const strArr = z.array(z.string()).default([])

const ExperienceContent = z.object({
  company: z.string().default(''),
  role: z.string().default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  location: z.string().default(''),
  bullets: strArr,
})

const ProjectContent = z.object({
  name: z.string().default(''),
  url: z.string().default(''),
  techStack: z.string().default(''),
  bullets: strArr,
})

const SkillsContent = z.object({
  category: z.string().default(''),
  items: z.string().default(''),
})

const EducationContent = z.object({
  school: z.string().default(''),
  degree: z.string().default(''),
  startYear: z.string().default(''),
  endYear: z.string().default(''),
  gpa: z.string().default(''),
  bullets: strArr,
})

const ResumeBlockEntry = z.discriminatedUnion('section', [
  z.object({ section: z.literal('EXPERIENCE'), content: ExperienceContent, skillTags: strArr }),
  z.object({ section: z.literal('PROJECTS'), content: ProjectContent, skillTags: strArr }),
  z.object({ section: z.literal('SKILLS'), content: SkillsContent, skillTags: strArr }),
  z.object({ section: z.literal('EDUCATION'), content: EducationContent, skillTags: strArr }),
])

export const ResumeParseSchema = z.array(ResumeBlockEntry).min(1)
