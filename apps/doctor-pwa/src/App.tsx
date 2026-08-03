import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DoctorKeyGate } from './features/auth/DoctorKeyGate';
import { DoctorBookingsRoute } from './features/bookings/DoctorBookingsRoute';
import { DoctorCallRoute } from './features/call/DoctorCallRoute';
import { DoctorQuestionsRoute } from './features/questions/DoctorQuestionsRoute';

export default function App() {
  return (
    <BrowserRouter>
      <DoctorKeyGate>
        <Routes>
          <Route path="/" element={<DoctorBookingsRoute />} />
          <Route path="/call/:consultationId" element={<DoctorCallRoute />} />
          <Route path="/questions" element={<DoctorQuestionsRoute />} />
        </Routes>
      </DoctorKeyGate>
    </BrowserRouter>
  );
}
