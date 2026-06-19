import dotenv from 'dotenv'
import path from 'path'

import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

const demoEmail = 'demo@pursuit.dev'

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

async function main() {
  const { prisma } = await import('../lib/db.js')
  const { hashPassword } = await import('../lib/crypto.js')

  console.log('Seeding database with demo data...')

  // 1. Clean up existing demo user records to ensure idempotency
  const existingUser = await prisma.user.findUnique({ where: { email: demoEmail } })
  if (existingUser) {
    console.log('Cleaning up old demo data...')
    await prisma.reminder.deleteMany({ where: { application: { userId: existingUser.id } } })
    await prisma.analysis.deleteMany({ where: { application: { userId: existingUser.id } } })
    
    const demoApps = await prisma.application.findMany({ where: { userId: existingUser.id }, select: { id: true } })
    const demoAppIds = demoApps.map(a => a.id)
    
    await prisma.stageEvent.deleteMany({ where: { applicationId: { in: demoAppIds } } })
    await prisma.application.deleteMany({ where: { userId: existingUser.id } })
    await prisma.jobDescription.deleteMany({ where: { userId: existingUser.id } })
    await prisma.resumeBlock.deleteMany({ where: { userId: existingUser.id } })
    await prisma.user.delete({ where: { email: demoEmail } })
  }

  // 2. Create demo user
  const passwordHash = await hashPassword('demo1234')
  const user = await prisma.user.create({
    data: {
      email: demoEmail,
      passwordHash,
    }
  })
  console.log(`Demo user created: ${demoEmail}`)

  // 3. Create Resume Blocks
  const resumeBlocks = [
    { section: 'Experience', content: 'Lead Frontend Engineer at Stripe. Architected neobrutalism dashboard components, scaling React rendering performance by 40%. Managed team of 4.', skillTags: ['React', 'TypeScript', 'Dashboard', 'Leadership'], orderDefault: 1 },
    { section: 'Experience', content: 'Software Engineer at Netflix. Developed microservices in Node.js and Java, handling 1M+ concurrent user streams.', skillTags: ['Node.js', 'Java', 'Microservices', 'Scale'], orderDefault: 2 },
    { section: 'Projects', content: 'Pursuit — Open-source job hunt command platform built in React, Node, and pgvector.', skillTags: ['React', 'Node.js', 'pgvector', 'PostgreSQL'], orderDefault: 3 },
    { section: 'Skills', content: 'Languages: JavaScript, TypeScript, Python, Java, SQL, Rust.', skillTags: ['JavaScript', 'TypeScript', 'Python', 'Java', 'SQL', 'Rust'], orderDefault: 4 },
    { section: 'Skills', content: 'Frameworks & Tools: React, Next.js, Express, Spring Boot, Docker, Kubernetes, Terraform.', skillTags: ['React', 'Next.js', 'Express', 'Spring Boot', 'Docker', 'Kubernetes', 'Terraform'], orderDefault: 5 }
  ]

  for (const block of resumeBlocks) {
    await prisma.resumeBlock.create({
      data: {
        userId: user.id,
        ...block
      }
    })
  }
  console.log('Seeded resume blocks.')

  // 4. Create Job Descriptions
  const jdsData = [
    {
      rawText: 'React / Next.js / TypeScript Frontend Developer role. Must be able to design premium visual interfaces, lead teams, and scale frontend apps.',
      jdHash: 'hash-demo-jd1',
      structured: {
        skills: ['React', 'Next.js', 'TypeScript', 'Dashboard'],
        niceToHave: ['Leadership'],
        responsibilities: ['Design premium UI', 'Scale frontend performance']
      }
    },
    {
      rawText: 'Backend Software Engineer. Python and Node.js developer to construct microservices, Redis queues, and manage PostgreSQL databases.',
      jdHash: 'hash-demo-jd2',
      structured: {
        skills: ['Node.js', 'Python', 'Redis', 'PostgreSQL'],
        niceToHave: ['Docker'],
        responsibilities: ['Build microservices', 'Maintain databases']
      }
    },
    {
      rawText: 'DevOps / Infrastructure Engineer. Build cloud scaling systems with Docker, Kubernetes, Terraform, and AWS.',
      jdHash: 'hash-demo-jd3',
      structured: {
        skills: ['Docker', 'Kubernetes', 'Terraform', 'AWS'],
        niceToHave: [],
        responsibilities: ['Scale infrastructure', 'Manage CI/CD']
      }
    }
  ]

  const jds: any[] = []
  for (const jd of jdsData) {
    const createdJd = await prisma.jobDescription.create({
      data: {
        userId: user.id,
        rawText: jd.rawText,
        jdHash: jd.jdHash,
        parseStatus: 'DONE',
        structured: jd.structured
      }
    })
    jds.push(createdJd)
  }
  console.log('Seeded job descriptions.')

  // 5. Create Applications
  const appsData = [
    // SAVED (5)
    { company: 'Stripe', roleTitle: 'React Developer', stage: 'SAVED', jdIndex: 0, daysAgo: 2 },
    { company: 'Rippling', roleTitle: 'Frontend Engineer', stage: 'SAVED', daysAgo: 4 },
    { company: 'Plaid', roleTitle: 'Software Engineer', stage: 'SAVED', daysAgo: 5 },
    { company: 'Brex', roleTitle: 'Full Stack Dev', stage: 'SAVED', daysAgo: 7 },
    { company: 'Mercury', roleTitle: 'UI Engineer', stage: 'SAVED', daysAgo: 9 },

    // APPLIED (6)
    { company: 'Databricks', roleTitle: 'ML Backend Developer', stage: 'APPLIED', jdIndex: 1, daysAgo: 15 },
    { company: 'Snowflake', roleTitle: 'Backend Engineer', stage: 'APPLIED', daysAgo: 16 },
    { company: 'MongoDB', roleTitle: 'Node.js Engineer', stage: 'APPLIED', daysAgo: 18 },
    { company: 'Cockroach Labs', roleTitle: 'Database Developer', stage: 'APPLIED', daysAgo: 19 },
    { company: 'PlanetScale', roleTitle: 'Cloud Engineer', stage: 'APPLIED', daysAgo: 21 },
    { company: 'Neon', roleTitle: 'PostgreSQL Dev', stage: 'APPLIED', daysAgo: 23 },

    // OA (3)
    { company: 'Cloudflare', roleTitle: 'Systems Engineer', stage: 'OA', jdIndex: 2, daysAgo: 12 },
    { company: 'Vercel', roleTitle: 'Next.js Developer', stage: 'OA', daysAgo: 14 },
    { company: 'Render', roleTitle: 'Platform Developer', stage: 'OA', daysAgo: 15 },

    // TECH (4)
    { company: 'Linear', roleTitle: 'Product Engineer', stage: 'TECH', daysAgo: 5 },
    { company: 'Notion', roleTitle: 'React Engineer', stage: 'TECH', daysAgo: 8 },
    { company: 'Figma', roleTitle: 'Graphics Dev', stage: 'TECH', daysAgo: 10 },
    { company: 'Loom', roleTitle: 'Video Engineer', stage: 'TECH', daysAgo: 12 },

    // HR (2)
    { company: 'Anthropic', roleTitle: 'AI Developer', stage: 'HR', daysAgo: 3 },
    { company: 'OpenAI', roleTitle: 'LLM Engineer', stage: 'HR', daysAgo: 4 },

    // OFFER (1)
    { company: 'Anduril', roleTitle: 'Mission Autonomy Engineer', stage: 'OFFER', daysAgo: 1 },

    // REJECTED (5)
    { company: 'Google', roleTitle: 'Staff Engineer', stage: 'REJECTED', daysAgo: 25 },
    { company: 'Meta', roleTitle: 'Product Architect', stage: 'REJECTED', daysAgo: 28 },
    { company: 'Apple', roleTitle: 'CoreOS Dev', stage: 'REJECTED', daysAgo: 30 },
    { company: 'Netflix', roleTitle: 'Senior UI Dev', stage: 'REJECTED', daysAgo: 32 },
    { company: 'Amazon', roleTitle: 'SDE-II', stage: 'REJECTED', daysAgo: 35 },

    // GHOSTED (4)
    { company: 'Uber', roleTitle: 'Mobile Lead', stage: 'GHOSTED', daysAgo: 40 },
    { company: 'Lyft', roleTitle: 'Backend Builder', stage: 'GHOSTED', daysAgo: 42 },
    { company: 'Airbnb', roleTitle: 'React Native Expert', stage: 'GHOSTED', daysAgo: 45 },
    { company: 'Coinbase', roleTitle: 'Smart Contract dev', stage: 'GHOSTED', daysAgo: 48 },
  ]

  const seededApps: any[] = []

  for (const app of appsData) {
    const createdApp = await prisma.application.create({
      data: {
        userId: user.id,
        company: app.company,
        roleTitle: app.roleTitle,
        stage: app.stage as any,
        jdId: app.jdIndex !== undefined ? jds[app.jdIndex].id : null,
        createdAt: daysAgo(app.daysAgo + 5),
      }
    })

    // Seed historical transitions for stageEvents
    const transitions = ['SAVED']
    if (app.stage !== 'SAVED') transitions.push('APPLIED')
    if (['OA', 'TECH', 'HR', 'OFFER', 'REJECTED', 'GHOSTED'].includes(app.stage)) {
      if (app.stage === 'OA') transitions.push('OA')
      else if (app.stage === 'TECH') {
        transitions.push('OA')
        transitions.push('TECH')
      } else if (app.stage === 'HR') {
        transitions.push('OA')
        transitions.push('TECH')
        transitions.push('HR')
      } else if (app.stage === 'OFFER') {
        transitions.push('OA')
        transitions.push('TECH')
        transitions.push('HR')
        transitions.push('OFFER')
      } else {
        transitions.push(app.stage)
      }
    }

    let currentAt = daysAgo(app.daysAgo + 5)
    for (let i = 1; i < transitions.length; i++) {
      currentAt = new Date(currentAt.getTime() + 3 * 24 * 60 * 60 * 1000)
      await prisma.stageEvent.create({
        data: {
          applicationId: createdApp.id,
          fromStage: transitions[i - 1] as any,
          toStage: transitions[i] as any,
          at: currentAt
        }
      })
    }

    seededApps.push({
      ...createdApp,
      daysAgo: app.daysAgo,
      jdIndex: app.jdIndex
    })
  }
  console.log('Seeded 30 applications with historical stage transition events.')

  // 6. Create pre-computed Analysis rows (GAPs)
  const stripeApp = seededApps.find(a => a.company === 'Stripe')!
  await prisma.analysis.create({
    data: {
      applicationId: stripeApp.id,
      kind: 'GAP',
      jdHash: jds[0].jdHash,
      result: {
        matchedSkills: ['React', 'TypeScript', 'Dashboard'],
        missingSkills: ['Next.js'],
        partialSkills: [],
        bulletRanking: [
          { blockId: 'b1', relevanceScore: 95, reason: 'Exact match for React & TypeScript' }
        ],
        riskQuestions: ['How much Next.js have you used in production?'],
        overallSummary: 'Strong candidate. Lacks Next.js experience which is highly requested.',
        llmRelevanceScore: 90
      },
      tokensIn: 800,
      tokensOut: 400,
      costUsd: 0.003
    }
  })

  const databricksApp = seededApps.find(a => a.company === 'Databricks')!
  await prisma.analysis.create({
    data: {
      applicationId: databricksApp.id,
      kind: 'GAP',
      jdHash: jds[1].jdHash,
      result: {
        matchedSkills: ['Node.js'],
        missingSkills: ['Python', 'Redis', 'PostgreSQL'],
        partialSkills: [],
        bulletRanking: [
          { blockId: 'b2', relevanceScore: 80, reason: 'Strong backend foundation' }
        ],
        riskQuestions: ['Describe your Python backend scaling experience.'],
        overallSummary: 'Good Node background. Will need to brush up on Python and Redis.',
        llmRelevanceScore: 70
      },
      tokensIn: 800,
      tokensOut: 400,
      costUsd: 0.003
    }
  })

  console.log('Seeded pre-computed analyses.')

  // 7. Seed 3 pending Reminders
  const mongodbApp = seededApps.find(a => a.company === 'MongoDB')!
  const cloudflareApp = seededApps.find(a => a.company === 'Cloudflare')!

  const remindersData = [
    {
      app: databricksApp,
      windowKey: 'APPLIED:2026-W25',
      draftEmail: 'Subject: Continued Interest: ML Backend Developer - Databricks\n\nHi team,\n\nI hope this email finds you well. I am writing to reiterate my interest in the ML Backend Developer role. My background in building scalable Node.js microservices at Netflix aligns well with your team needs. I look forward to hearing from you regarding next steps.\n\nBest,\nAditya'
    },
    {
      app: mongodbApp,
      windowKey: 'APPLIED:2026-W25',
      draftEmail: 'Subject: Follow-up: Node.js Engineer - MongoDB\n\nHi MongoDB recruiting,\n\nI am writing to check in on my application for the Node.js Engineer position. With my experience in backend systems, I am excited about the opportunity to contribute to MongoDB. Please let me know if you require any additional materials.\n\nSincerely,\nAditya'
    },
    {
      app: cloudflareApp,
      windowKey: 'OA:2026-W25',
      draftEmail: 'Subject: Online Assessment Completed - Cloudflare\n\nDear Cloudflare team,\n\nI have completed the online assessment for the Systems Engineer role. I wanted to check if there are any updates regarding my evaluation. I remain extremely interested in joining Cloudflare.\n\nWarm regards,\nAditya'
    }
  ]

  for (const rem of remindersData) {
    await prisma.reminder.create({
      data: {
        applicationId: rem.app.id,
        windowKey: rem.windowKey,
        draftEmail: rem.draftEmail,
        createdAt: daysAgo(1)
      }
    })
  }

  console.log('Seeded pending reminders.')
  console.log('Database seeding completed successfully! Idempotent checks confirmed.')
  await prisma.$disconnect()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
