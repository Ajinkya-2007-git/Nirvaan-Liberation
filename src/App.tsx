// The root component. This is where we set up ROUTING — deciding
// which page component to show based on the URL in the browser's
// address bar. Without this, our app can only ever show one screen.

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { RequestHelp } from './pages/RequestHelp';
import { VolunteerSignup } from './pages/VolunteerSignup';
import { Login } from './pages/Login';
import { CompleteVolunteerProfile } from './pages/CompleteVolunteerProfile';
import { Map } from './pages/Map';
import { AdminPanel } from './pages/AdminPanel';
import { NgoSignup } from './pages/NgoSignup';
import { NgoCompleteProfile } from './pages/NgoCompleteProfile';
import { NgoPending } from './pages/NgoPending';
import { AdminNgoApprovals } from './pages/AdminNgoApprovals';
import { OfflineBanner } from './components/OfflineBanner';
import { useOfflineSync } from './hooks/useOfflineSync';

function App() {
  // Called once here, at the top of the whole app, rather than
  // inside any single page — this is what makes syncing happen
  // automatically no matter which screen someone is on when their
  // connection comes back.
  const { pendingCount } = useOfflineSync();

  return (
    // BrowserRouter turns on routing for everything inside it —
    // it watches the URL and re-renders whichever <Route> matches.
    <BrowserRouter>
      <Routes>
        {/* path="/" is the homepage — what you see with no extra URL path */}
        <Route path="/" element={<Landing />} />
        <Route path="/request-help" element={<RequestHelp />} />
        <Route path="/volunteer/signup" element={<VolunteerSignup />} />
        <Route path="/volunteer/login" element={<Login />} />
        <Route path="/volunteer/complete-profile" element={<CompleteVolunteerProfile />} />
        <Route path="/ngo/signup" element={<NgoSignup />} />
        <Route path="/ngo/complete-profile" element={<NgoCompleteProfile />} />
        <Route path="/ngo/pending" element={<NgoPending />} />
        <Route path="/map" element={<Map />} />
        {/* No public link points here on purpose — an admin account
            is never created through a signup form (see the SQL note
            for how one gets made), so there's nothing to "discover"
            by browsing the site. The role check inside AdminPanel
            itself is still what actually enforces access, though —
            this route being unlinked is just good hygiene, not
            the real security boundary. */}
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/ngos" element={<AdminNgoApprovals />} />
      </Routes>

      <OfflineBanner pendingCount={pendingCount} />
    </BrowserRouter>
  );
}

export default App;
