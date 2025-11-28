/**
 * Hosted UI ログインページ（MUI 版）
 * ボタンクリックでのみCognito Hosted UIにリダイレクト
 */
import { signInWithRedirect } from '@aws-amplify/auth';
import {
  Backdrop,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Typography,
} from '@mui/material';

import * as React from 'react';
import { useNotify } from 'react-admin';

const SIGNED_OUT_FLAG = 'ainews.signedOut';

export function LoginPage() {
  const notify = useNotify();
  const [loading, setLoading] = React.useState(false);

  const handleLogin = async () => {
    try {
      // ログアウトフラグをクリア（明示的なログイン操作）
      localStorage.removeItem(SIGNED_OUT_FLAG);

      setLoading(true);
      await signInWithRedirect();
    } catch (e: unknown) {
      setLoading(false);
      const message = e instanceof Error ? e.message : 'Redirecting to Cognito sign-in failed';
      notify(message, { type: 'warning' });
    }
  };

  return (
    <>
      {/* 画面中央レイアウト */}
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Container maxWidth="xs">
          <Paper elevation={3} sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
            <Typography variant="h5" sx={{ mb: 1 }}>
              AI News Admin
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Please sign in with your Cognito account.
            </Typography>

            <Button
              type="button"
              variant="contained"
              color="primary"
              fullWidth
              onClick={handleLogin}
              disabled={loading}
            >
              Sign in
            </Button>
          </Paper>
        </Container>
      </Box>

      {/* リダイレクト中のフリッカー抑止 */}
      <Backdrop open={loading} sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Box sx={{ display: 'grid', justifyItems: 'center', rowGap: 2 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.primary">
            Redirecting…
          </Typography>
        </Box>
      </Backdrop>
    </>
  );
}
