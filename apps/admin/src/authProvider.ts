// src/auth/authProvider.ts
import { fetchAuthSession, getCurrentUser, signInWithRedirect, signOut } from '@aws-amplify/auth';

import type { AuthProvider } from 'react-admin';

const SIGNED_OUT_FLAG = 'ainews.signedOut';

/**
 * ログアウト時にクリアするAmplifyのローカルストレージキー
 */
const AMPLIFY_KEYS = [
  'amplify-signin-with-hostedUI',
  'amplify-auto-sign-in',
  'amplify-redirected-from-hosted-ui',
];

/**
 * IDトークンを取得（dataProviderで使用）
 */
export const getIdToken = async (): Promise<string | null> => {
  try {
    const { tokens } = await fetchAuthSession();
    return tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
};

export const authProvider: AuthProvider = {
  async login() {
    // ログアウトフラグをクリア（明示的なログイン操作）
    localStorage.removeItem(SIGNED_OUT_FLAG);

    // Amplify に任せる（PKCE 前処理込み）
    await signInWithRedirect();
  },

  async logout() {
    try {
      // 「ログアウト直後に自動再ログインさせない」ためのフラグ
      localStorage.setItem(SIGNED_OUT_FLAG, '1');

      // Amplifyのローカルストレージキーを明示的にクリア
      // これにより、ログアウト後の自動リダイレクトを防止
      AMPLIFY_KEYS.forEach((key) => {
        localStorage.removeItem(key);
      });

      // グローバルサインアウトでCognitoセッションを完全に破棄
      // global: true により Cognito Hosted UI の /logout エンドポイントにリダイレクトされる
      // redirectSignOut で設定されたURL（/login）にログアウト後リダイレクトされる
      await signOut({ global: true });
    } catch (error) {
      // エラーが発生してもログアウトフラグは維持
      console.error('Logout error:', error);
      // エラーが発生しても続行（ローカルストレージはクリア済み）
    }
  },

  async checkAuth() {
    // ログアウト直後の場合は、自動ログインを試みずに即座に拒否
    if (localStorage.getItem(SIGNED_OUT_FLAG) === '1') {
      return Promise.reject(new Error('User signed out'));
    }

    // 未ログインなら例外 → react-admin が /login を表示（LoginPage はボタンのみで自動遷移しない）
    await getCurrentUser();
  },

  async checkError() {
    return;
  },

  async getPermissions() {
    return;
  },
};
