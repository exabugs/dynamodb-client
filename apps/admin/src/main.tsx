/**
 * React エントリポイント
 * Amplify v6 Hosted UI対応
 */
import { fetchAuthSession } from '@aws-amplify/auth';
import { Backdrop, Box, CircularProgress, Typography } from '@mui/material';
import { Amplify } from 'aws-amplify';

import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';

import App from './App';

// ==========================
// Hosted UI コールバック
// ==========================
function AuthCallback() {
  const navigate = useNavigate();

  React.useEffect(() => {
    (async () => {
      try {
        await fetchAuthSession();
        // ログイン成功したので、ログアウトフラグをクリア
        localStorage.removeItem('ainews.signedOut');
        navigate('/', { replace: true });
      } catch {
        navigate('/login', { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <Backdrop open sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
      <Box sx={{ display: 'grid', justifyItems: 'center', rowGap: 2 }}>
        <CircularProgress />
        <Typography variant="body2">Completing sign-in…</Typography>
      </Box>
    </Backdrop>
  );
}

// ==========================
// Amplify 設定（v6 Hosted UI対応）
// ==========================
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID as string;
const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID as string;
const domain = import.meta.env.VITE_COGNITO_DOMAIN as string;

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId,
      userPoolClientId,
      loginWith: {
        oauth: {
          domain,
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [`${window.location.origin}/callback`],
          redirectSignOut: [`${window.location.origin}/login`],
          responseType: 'code',
        },
      },
    },
  },
});

// ==========================
// ルーティング
// ==========================
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

// ==========================
// React エントリポイント
// ==========================
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
