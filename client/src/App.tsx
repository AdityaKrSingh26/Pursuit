import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AuthPage from './features/auth/AuthPage'
import LandingPage from './features/marketing/LandingPage'
import KanbanPage from './features/applications/KanbanPage'
import ListPage from './features/applications/ListPage'
import DashboardPage from './features/dashboard/DashboardPage'
import ResumeEditor from './features/resume/ResumeEditor'
import IntelPage from './features/intel/IntelPage'
import RemindersPanel from './features/reminders/RemindersPanel'
import JobsPage from './features/jobs/JobsPage'

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
            <Route path="/resume" element={<ResumeEditor />} />
            <Route path="/intelligence" element={<IntelPage />} />
            <Route path="/reminders" element={<RemindersPanel />} />
            <Route path="/jobs" element={<JobsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
