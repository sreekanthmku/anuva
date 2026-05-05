import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AssessmentRoute from '../features/onboarding/AssessmentRoute';
import AssessmentResultRoute from '../features/onboarding/AssessmentResultRoute';
import AnuGreetingRoute from '../features/onboarding/AnuGreetingRoute';
import SubscriptionRoute from '../features/onboarding/SubscriptionRoute';
import AnuDashboardRoute from '../features/core/AnuDashboardRoute';
import AnuChatRoute from '../features/core/AnuChatRoute';
import SymptomTrackRoute from '../features/core/SymptomTrackRoute';
import WeeklyReportRoute from '../features/core/WeeklyReportRoute';
import CareDirectionRoute from '../features/core/CareDirectionRoute';
import LibraryRoute from '../features/core/LibraryRoute';
import AnonymousQARoute from '../features/core/AnonymousQARoute';
import ConsultationBookingRoute from '../features/core/ConsultationBookingRoute';
import ProfileRoute from '../features/core/ProfileRoute';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AssessmentRoute />} />
        <Route path="/assessment-result" element={<AssessmentResultRoute />} />
        <Route path="/subscription" element={<SubscriptionRoute />} />
        <Route path="/anu-greeting" element={<AnuGreetingRoute />} />
        <Route path="/home" element={<AnuDashboardRoute />} />
        <Route path="/chat" element={<AnuChatRoute />} />
        <Route path="/track" element={<SymptomTrackRoute />} />
        <Route path="/report" element={<WeeklyReportRoute />} />
        <Route path="/care" element={<CareDirectionRoute />} />
        <Route path="/library" element={<LibraryRoute />} />
        <Route path="/qa" element={<AnonymousQARoute />} />
        <Route path="/booking" element={<ConsultationBookingRoute />} />
        <Route path="/profile" element={<ProfileRoute />} />
      </Routes>
    </BrowserRouter>
  );
}

