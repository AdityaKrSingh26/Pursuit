import express from 'express'
import cookieParser from 'cookie-parser'

const app = express()
app.use(express.json())
app.use(cookieParser())

app.get('/health', (_req, res) => res.json({ ok: true }))

const port = process.env.PORT ?? 3001
app.listen(port, () => console.log(`API listening on ${port}`))

export { app }
