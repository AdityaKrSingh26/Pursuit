import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../stores/auth'
import { STAGES } from '../../lib/stages'

const FEATURES = [
  {
    code: '01',
    title: 'Pipeline that moves',
    body: 'Drag every application across eight stages. Stage history is timestamped automatically, so your funnel is never a guess.',
  },
  {
    code: '02',
    title: 'Job descriptions, parsed',
    body: 'Paste a URL or raw text. A background worker fetches, strips boilerplate, and an LLM turns it into structured skills, YOE, and responsibilities.',
  },
  {
    code: '03',
    title: 'Gap analysis, streamed',
    body: 'See exactly how your resume matches a JD — matched, partial, and missing skills, a transparent match score, and the questions you will get probed on.',
  },
  {
    code: '04',
    title: 'Interview prep on tap',
    body: 'Technical, behavioral, and gap-probe questions generated per company, each carrying the reason it will come up.',
  },
]

const STEPS = [
  { n: '1', t: 'Save the role', d: 'URL or pasted JD — it lands in your pipeline in seconds.' },
  { n: '2', t: 'Let it parse', d: 'The worker structures the JD while you keep moving.' },
  { n: '3', t: 'Analyze the fit', d: 'Run gap analysis and prep before you hit apply.' },
  { n: '4', t: 'Work the funnel', d: 'Drag, follow up, and watch your conversion sharpen.' },
]

export default function LandingPage() {
  const user = useAuth((s) => s.user)
  if (user) return <Navigate to="/" replace />

  return (
    <div className="min-h-full overflow-y-auto">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b-[1.5px] border-line bg-paper/90 px-6 py-4 backdrop-blur sm:px-10">
        <div className="flex items-baseline gap-2">
          <span className="h-3 w-3 bg-signal" />
          <span className="font-display text-2xl font-black tracking-tight">Pursuit</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            to="/login"
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft hover:text-signal"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="press inline-flex bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-paper-3"
          >
            Start tracking →
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b-[1.5px] border-line px-6 py-20 sm:px-10 sm:py-28">
        <span className="pointer-events-none absolute -right-16 top-1/2 hidden -translate-y-1/2 select-none font-display text-[22vw] font-black leading-none text-ink/[0.045] lg:block">
          HUNT
        </span>
        <div className="relative max-w-3xl">
          <p className="label">A job-hunt command center</p>
          <h1 className="mt-4 font-display text-6xl font-black leading-[0.95] tracking-tight sm:text-8xl">
            Run your job
            <br />
            search like
            <br />
            <span className="text-signal">an operation.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            Track every application, parse every job description, and know your fit before
            you apply. Built by someone running 100+ applications who got tired of losing
            the thread.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/register"
              className="press inline-flex bg-signal px-6 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-paper-3"
            >
              Open a case file →
            </Link>
            <Link
              to="/login"
              className="border-[1.5px] border-line px-6 py-3 font-mono text-[12px] uppercase tracking-[0.16em] hover:bg-paper-2"
            >
              I already track here
            </Link>
          </div>

          {/* Mini pipeline preview — the product's signature view, as a static strip. */}
          <div className="mt-12 flex flex-wrap gap-1.5">
            {STAGES.map((s) => (
              <div
                key={s.code}
                className="flex items-center gap-1.5 border border-line bg-paper-2 px-2.5 py-1"
                style={{ backgroundColor: s.swatch + '1a' }}
              >
                <span className="h-2 w-2" style={{ backgroundColor: s.swatch }} />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b-[1.5px] border-line px-6 py-16 sm:px-10">
        <p className="label">What it does</p>
        <div className="mt-6 grid gap-px border-[1.5px] border-line bg-line sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.code} className="bg-paper-2 p-7">
              <span className="font-mono text-sm text-signal">{f.code}</span>
              <h3 className="mt-2 font-display text-2xl font-bold">{f.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-b-[1.5px] border-line px-6 py-16 sm:px-10">
        <p className="label">The loop</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="relative">
              <span className="font-display text-5xl font-black text-ink/15">{s.n}</span>
              <h3 className="mt-1 font-display text-xl font-bold">{s.t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center sm:px-10">
        <h2 className="font-display text-4xl font-black sm:text-5xl">
          Stop losing the thread.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">
          One place for every role you are chasing. Free to start, yours to run.
        </p>
        <Link
          to="/register"
          className="press mt-7 inline-flex bg-signal px-7 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-paper-3"
        >
          Start the hunt →
        </Link>
      </section>

      <footer className="border-t-[1.5px] border-line px-6 py-6 sm:px-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          Pursuit · Job-Hunt Command Center
        </p>
      </footer>
    </div>
  )
}
