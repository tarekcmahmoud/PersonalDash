import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './ui/AppShell'
import { RequireAuth } from './ui/RequireAuth'
import { ImportPage } from './ui/routes/ImportPage'
import { InboxPage } from './ui/routes/InboxPage'
import { LoginPage } from './ui/routes/LoginPage'
import { PlanPage } from './ui/routes/PlanPage'
import { ProjectPage } from './ui/routes/ProjectPage'
import { ProjectsPage } from './ui/routes/ProjectsPage'
import { ReviewPage } from './ui/routes/ReviewPage'
import { SettingsPage } from './ui/routes/SettingsPage'
import { TemplatesPage } from './ui/routes/TemplatesPage'
import { TodayPage } from './ui/routes/TodayPage'
import { WeekPage } from './ui/routes/WeekPage'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<TodayPage />} />
        <Route path="week" element={<WeekPage />} />
        <Route path="plan" element={<PlanPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
