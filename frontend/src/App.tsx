import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './pages/Dashboard';
import WorkOrders from './pages/WorkOrders';
import Lines from './pages/Lines';
import Schedule from './pages/Schedule';
import Layout from './components/Layout';

// Initialize React Query client
const queryClient = new QueryClient();

// Get Clerk publishable key from environment variable
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function App() {
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <QueryClientProvider client={queryClient}>
        <Router>
          <SignedOut>
            <Routes>
              <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" />} />
              <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" />} />
              <Route path="*" element={<Navigate to="/sign-in" replace />} />
            </Routes>
          </SignedOut>
          <SignedIn>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/work-orders" element={<WorkOrders />} />
                <Route path="/lines" element={<Lines />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </SignedIn>
        </Router>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
