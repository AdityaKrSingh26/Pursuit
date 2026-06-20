import express from 'express'
import cookieParser from 'cookie-parser'
import { authRouter } from './modules/auth/auth.router.js'
import { applicationsRouter } from './modules/applications/applications.router.js'
import { ingestionRouter } from './modules/ingestion/ingestion.router.js'
import { analysisRouter } from './modules/analysis/analysis.router.js'
import { resumeRouter } from './modules/resume/resume.router.js'
import { dashboardRouter } from './modules/dashboard/dashboard.router.js'
import { intelRouter } from './modules/intel/intel.router.js'
import { remindersRouter } from './modules/reminders/reminders.router.js'
import { jobsRouter } from './modules/jobs/jobs.router.js'
import { AppError } from './lib/errors.js'

const app = express()
app.use(express.json())
app.use(cookieParser())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/v1/auth', authRouter)
app.use('/api/v1', applicationsRouter)
app.use('/api/v1', ingestionRouter)
app.use('/api/v1', analysisRouter)
app.use('/api/v1', resumeRouter)
app.use('/api/v1', dashboardRouter)
app.use('/api/v1', intelRouter)
app.use('/api/v1', remindersRouter)
app.use('/api/v1', jobsRouter)

// Global error handler (4-param signature tells Express this is an error handler)
app.use((err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ ok: false, error: { code: err.code, message: err.message } })
    return
  }
  console.error(err)
  res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
})

const port = process.env.PORT ?? 3001
app.listen(port, () => console.log(`API listening on ${port}`))

export { app }
