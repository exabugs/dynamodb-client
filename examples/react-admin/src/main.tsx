/**
 * React Entry Point
 * Handles OAuth callback from Cognito Hosted UI
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { App } from './App';
import { handleOAuthCallback } from './authProvider';

/**
 * OAuth Callback Handler
 */
function AuthCallback() {
  const navigate = useNavigate();

  React.useEffect(() => {
    handleOAuthCallback()
      .then(() => {
        // Redirect to home after successful authentication
        navigate('/', { replace: true });
      })
      .catch((error) => {
        console.error('OAuth callback error:', error);
        // Redirect to login on error
        navigate('/login', { replace: true });
      });
  }, [navigate]);

  return (
    <div
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
    >
      <div>
        <p>Completing sign-in...</p>
      </div>
    </div>
  );
}

/**
 * Root Component with Routing
 */
function Root() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/callback" element={<AuthCallback />} />
        <Route path="/*" element={<App />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

/**
 * Render App
 */
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
