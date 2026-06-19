import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AuthPage from './features/auth/AuthPage'
import LandingPage from './features/marketing/LandingPage'
import KanbanPage from './features/applications/KanbanPage'
import ListPage from './features/applications/ListPage'
import DashboardPage from './features/dashboard/DashboardPage'
import ComingSoon from './features/stubs/ComingSoon'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/welcome" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<KanbanPage />} />
            <Route path="/applications/list" element={<ListPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route
              path="/resume"
              element={
                <ComingSoon
                  index="04"
                  title="Resume"
                  subtitle="Block-structured master resume and per-application tailoring."
                  phase="Phase 08"
                  cards={[
                    { name: 'Master blocks', detail: 'Editable experience, projects, skills, and education blocks with skill tags.' },
                    { name: 'Tailoring diff', detail: 'LLM-proposed reorder and rewrites with accept / edit / reject per bullet.' },
                    { name: 'Versioned PDFs', detail: 'Immutable resume snapshots rendered server-side and linked to each application.' },
                    { name: 'Drag reorder', detail: 'Reorder blocks within a section; archive without deleting.' },
                  ]}
                />
              }
            />
            <Route
              path="/intelligence"
              element={
                <ComingSoon
                  index="05"
                  title="Intel"
                  subtitle="Aggregate signal across every saved job description."
                  phase="Phase 10"
                  cards={[
                    { name: 'Skill demand', detail: 'Top skills across your targets and how that mix shifts over time.' },
                    { name: 'Gap frequency', detail: 'Which missing skills show up in the largest share of your roles.' },
                    { name: 'Similar jobs', detail: 'Embedding cosine top-k for any application.' },
                    { name: 'Clusters', detail: 'Roles grouped by similarity, labeled by dominant skills.' },
                  ]}
                />
              }
            />
            <Route
              path="/reminders"
              element={
                <ComingSoon
                  index="06"
                  title="Follow-ups"
                  subtitle="Catch applications that have gone quiet."
                  phase="Phase 11"
                  cards={[
                    { name: 'Needs follow-up', detail: 'Applications with no stage change for N days surface here.' },
                    { name: 'Drafted email', detail: 'LLM-drafted follow-up you can copy — never auto-sent.' },
                  ]}
                />
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
