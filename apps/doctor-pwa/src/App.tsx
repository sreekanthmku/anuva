import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DoctorLoginGate } from './features/auth/DoctorLoginGate';
import { DoctorBookingsRoute } from './features/bookings/DoctorBookingsRoute';
import { DoctorCallRoute } from './features/call/DoctorCallRoute';
import { DoctorQuestionsRoute } from './features/questions/DoctorQuestionsRoute';

export default function App() {
  return (
    <BrowserRouter>
      <DoctorLoginGate>
        <Routes>
          <Route path="/" element={<DoctorBookingsRoute />} />
          <Route path="/call/:consultationId" element={<DoctorCallRoute />} />
          <Route path="/questions" element={<DoctorQuestionsRoute />} />
        </Routes>
      </DoctorLoginGate>
    </BrowserRouter>
  );
}
