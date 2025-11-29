/**
 * React Admin Auth Provider
 * Uses Cognito Hosted UI with PKCE
 */
import { AuthProvider } from 'react-admin';

const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN;
const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;
const REDIRECT_URI = `${window.location.origin}/callback`;

/**
 * Generate random string for PKCE
 */
function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues)
    .map((v) => charset[v % charset.length])
    .join('');
}

/**
 * Generate SHA-256 hash
 */
async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

/**
 * Base64 URL encode
 */
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generate PKCE challenge
 */
async function generatePKCEChallenge(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateRandomString(128);
  const hashed = await sha256(verifier);
  const challenge = base64UrlEncode(hashed);
  return { verifier, challenge };
}

/**
 * Auth Provider
 */
export const authProvider: AuthProvider = {
  // Login - redirect to Cognito Hosted UI
  login: async () => {
    const { verifier, challenge } = await generatePKCEChallenge();
    sessionStorage.setItem('pkce_verifier', verifier);

    const params = new URLSearchParams({
      client_id: COGNITO_CLIENT_ID,
      response_type: 'code',
      scope: 'openid email profile',
      redirect_uri: REDIRECT_URI,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    window.location.href = `https://${COGNITO_DOMAIN}/oauth2/authorize?${params}`;
  },

  // Logout - clear tokens and redirect
  logout: async () => {
    localStorage.removeItem('idToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    const params = new URLSearchParams({
      client_id: COGNITO_CLIENT_ID,
      logout_uri: REDIRECT_URI,
    });

    window.location.href = `https://${COGNITO_DOMAIN}/logout?${params}`;
  },

  // Check auth
  checkAuth: async () => {
    if (!localStorage.getItem('idToken')) {
      throw new Error('Not authenticated');
    }
  },

  // Check error
  checkError: async (error) => {
    if (error.status === 401 || error.status === 403) {
      localStorage.clear();
      throw new Error('Authentication required');
    }
  },

  // Get permissions
  getPermissions: async () => undefined,

  // Get identity
  getIdentity: async () => {
    const idToken = localStorage.getItem('idToken');
    if (!idToken) {
      throw new Error('Not authenticated');
    }

    const payload = JSON.parse(atob(idToken.split('.')[1]));
    return {
      id: payload.sub,
      fullName: payload.name || payload.email,
      avatar: payload.picture,
    };
  },
};

/**
 * Get ID Token (for dataProvider)
 */
export async function getIdToken(): Promise<string | null> {
  return localStorage.getItem('idToken');
}

/**
 * Handle OAuth callback
 */
export async function handleOAuthCallback(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return;

  const verifier = sessionStorage.getItem('pkce_verifier');
  if (!verifier) {
    throw new Error('PKCE verifier not found');
  }

  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: COGNITO_CLIENT_ID,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });

  const response = await fetch(`https://${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams,
  });

  if (!response.ok) {
    throw new Error('Failed to exchange code for tokens');
  }

  const tokens = await response.json();
  localStorage.setItem('idToken', tokens.id_token);
  localStorage.setItem('accessToken', tokens.access_token);
  if (tokens.refresh_token) {
    localStorage.setItem('refreshToken', tokens.refresh_token);
  }

  sessionStorage.removeItem('pkce_verifier');
  window.history.replaceState({}, document.title, '/');
}
