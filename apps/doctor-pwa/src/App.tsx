import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DoctorKeyGate } from './features/auth/DoctorKeyGate';
import { DoctorBookingsRoute } from './features/bookings/DoctorBookingsRoute';
import { DoctorCallRoute } from './features/call/DoctorCallRoute';

export default function App() {
  return (
    <BrowserRouter>
      <DoctorKeyGate>
        <Routes>
          <Route path="/" element={<DoctorBookingsRoute />} />
          <Route path="/call/:consultationId" element={<DoctorCallRoute />} />
        </Routes>
      </DoctorKeyGate>
    </BrowserRouter>
  );
}
