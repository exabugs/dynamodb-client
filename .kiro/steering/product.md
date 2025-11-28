# プロダクト概要

AIニュース自動配信パイプライン (AI News Pipeline) - 自動化されたニュース処理・配信システム

## 目的

ニュース記事の処理における、記事取得から音声合成、動画レンダリング、配信までのエンドツーエンドワークフローを自動化する。システムは、DynamoDB Single-Table設計と動的シャドウ管理、AppSync GraphQL API、React管理インターフェース、Expo/React Nativeモバイルアプリを統合している。

## 主要機能

- **自動ニュースパイプライン**: fetch → translate → normalize → script → TTS → render → publish
- **動的シャドウ管理**: 効率的なソートとクエリのための自動シャドウレコード生成を備えたDynamoDB Single-Table設計
- **マルチクライアントサポート**: Web管理UI（React + react-admin）とモバイルアプリ（Expo/React Native）
- **GraphQL API**: Cognito認証を使用したAppSyncベースのAPI
- **メンテナンスシステム**: 並列処理によるシャドウ整合性検証と修復

## 対象ユーザー

- コンテンツマネージャー（管理UI経由）
- モバイルユーザー（モバイルアプリ経由）
- システム管理者（インフラ管理）
