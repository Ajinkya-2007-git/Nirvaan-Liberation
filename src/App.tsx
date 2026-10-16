// Root component: sets up routing, the offline sync, and the phone bottom navigation.
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { RequestHelp } from './pages/RequestHelp';
import { VolunteerSignup } from './pages/VolunteerSignup';
import { Login } from './pages/Login';
import { CompleteVolunteerProfile } from './pages/CompleteVolunteerProfile';
import { Map } from './pages/Map';
import { NgoSignup } from './pages/NgoSignup';
import { NgoCompleteProfile } from './pages/NgoCompleteProfile';
import { NgoPending } from './pages/NgoPending';
import { AdminNgoApprovals } from './pages/AdminNgoApprovals';
import { AdminRequests } from './pages/AdminRequests';
import { ForgotPassword } from './pages/ForgotPassword';
import { RequestTracking } from './pages/RequestTracking';
import { AdminImpact } from './pages/AdminImpact';
import { OfflineBanner } from './components/OfflineBanner';
import { BottomNav } from './components/BottomNav';
import { useOfflineSync } from './hooks/useOfflineSync';

// Lives inside the router so it can read the current URL.
function AppShell() {
  const location = useLocation();
  // Called once at the top so syncing queued offline requests happens on every screen.
  const { pendingCount } = useOfflineSync();
  // Leave room for the phone bottom bar on every page except admin pages (which hide it).
  const isAdminPage = location.pathname.startsWith('/admin');

  return (
    <div className={isAdminPage ? '' : 'pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0'}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/request-help" element={<RequestHelp />} />
        <Route path="/volunteer/signup" element={<VolunteerSignup />} />
        <Route path="/volunteer/login" element={<Login />} />
        <Route path="/volunteer/complete-profile" element={<CompleteVolunteerProfile />} />
        <Route path="/ngo/signup" element={<NgoSignup />} />
        <Route path="/ngo/complete-profile" element={<NgoCompleteProfile />} />
        <Route path="/ngo/pending" element={<NgoPending />} />
        <Route path="/map" element={<Map />} />
        {/* Admin pages have no public link; the role check inside each page is the real gate. */}
        <Route path="/admin" element={<Navigate to="/map" replace />} />
        <Route path="/admin/ngos" element={<AdminNgoApprovals />} />
        <Route path="/admin/requests" element={<AdminRequests />} />
        <Route path="/admin/impact" element={<AdminImpact />} />
        <Route path="/volunteer/forgot-password" element={<ForgotPassword />} />
        <Route path="/track/:requestId" element={<RequestTracking />} />
      </Routes>

      <OfflineBanner pendingCount={pendingCount} />
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
