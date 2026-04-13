import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { ToastProvider } from './hooks/useToast.jsx';
import { ThemeProvider } from './hooks/useTheme.jsx';
import { Login } from './pages/Login.jsx';
import { Register } from './pages/Register.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Repository } from './pages/Repository.jsx';
import { Analysis } from './pages/Analysis.jsx';
import { Repos } from './pages/Repos.jsx';
import { Settings } from './pages/Settings.jsx';
import { Demo } from './pages/Demo.jsx';

function Protegida({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-base)' }}>
      <div style={{ textAlign:'center' }}>
        <img src="/logo.svg" alt="" width={36} style={{ marginBottom:16, opacity:0.8 }} />
        <div style={{ width:22, height:22, margin:'0 auto', border:'2px solid var(--indigo-subtle)', borderTopColor:'var(--indigo)', borderRadius:'50%', animation:'spin 0.55s linear infinite' }} />
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Publica({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              {/* Públicas */}
              <Route path="/login"    element={<Publica><Login /></Publica>} />
              <Route path="/register" element={<Publica><Register /></Publica>} />
              <Route path="/demo"     element={<Demo />} />

              {/* Protegidas */}
              <Route path="/"              element={<Protegida><Dashboard /></Protegida>} />
              <Route path="/repos"         element={<Protegida><Repos /></Protegida>} />
              <Route path="/repos/:id"     element={<Protegida><Repository /></Protegida>} />
              <Route path="/analyses/:id"  element={<Protegida><Analysis /></Protegida>} />
              <Route path="/settings"      element={<Protegida><Settings /></Protegida>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
