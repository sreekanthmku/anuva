import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AssessmentPairedRoute from '../features/onboarding/AssessmentPairedRoute';
import AssessmentRoute from '../features/onboarding/AssessmentRoute';
import AssessmentResultRoute from '../features/onboarding/AssessmentResultRoute';
import AnuGreetingRoute from '../features/onboarding/AnuGreetingRoute';
import SubscriptionRoute from '../features/onboarding/SubscriptionRoute';
import AnuDashboardRoute from '../features/core/AnuDashboardRoute';
import NudgeCardRoute from '../features/core/NudgeCardRoute';
import DetailedAssessmentRoute from '../features/core/DetailedAssessmentRoute';
import AnuChatRoute from '../features/core/AnuChatRoute';
import SymptomTrackRoute from '../features/core/SymptomTrackRoute';
import WeeklyReportRoute from '../features/core/WeeklyReportRoute';
import CareDirectionRoute from '../features/core/CareDirectionRoute';
import LibraryRoute from '../features/core/LibraryRoute';
import AnonymousQARoute from '../features/core/AnonymousQARoute';
import ConsultationBookingRoute from '../features/core/ConsultationBookingRoute';
import ProfileRoute from '../features/core/ProfileRoute';
import LoginRoute from '../features/auth/LoginRoute';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import SplashRoute from '../features/auth/SplashRoute';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SplashRoute />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/assessment" element={<AssessmentRoute />} />
        <Route path="/assessment-paired" element={<AssessmentPairedRoute />} />
        <Route path="/assessment-result" element={<AssessmentResultRoute />} />
        <Route path="/subscription" element={<SubscriptionRoute />} />
        <Route path="/anu-greeting" element={<AnuGreetingRoute />} />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <AnuDashboardRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nudge/:slot"
          element={
            <ProtectedRoute>
              <NudgeCardRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nudge"
          element={
            <ProtectedRoute>
              <NudgeCardRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/detailed-assessment"
          element={
            <ProtectedRoute>
              <DetailedAssessmentRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <AnuChatRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/track"
          element={
            <ProtectedRoute>
              <SymptomTrackRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/report"
          element={
            <ProtectedRoute>
              <WeeklyReportRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/care"
          element={
            <ProtectedRoute>
              <CareDirectionRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/library"
          element={
            <ProtectedRoute>
              <LibraryRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/qa"
          element={
            <ProtectedRoute>
              <AnonymousQARoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/booking"
          element={
            <ProtectedRoute>
              <ConsultationBookingRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfileRoute />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
