import {
  Datagrid,
  FunctionField,
  InfiniteList,
  NumberField,
  SelectField,
  SelectInput,
  Show,
  SimpleShowLayout,
  TextField,
} from 'react-admin';

import type { FetchLog } from '@ainews/api-types';

import { DateTimeField } from '../components/DateTime';
import { ProviderField, ProviderInput } from '../components/Provider';

// import { Chip } from '@mui/material';

/**
 * FetchLog リソース定義
 * Fetch実行履歴の表示
 */

// 🔴🟠🟡🟢🔵🟣🟤⚫⚪
const tasksStatus = [
  { id: 'success', name: '🟢 成功' },
  { id: 'partial', name: '🟠 ワーニング' },
  { id: 'failure', name: '🔴 失敗' },
];

const filters = [
  <ProviderInput source="provider" alwaysOn />,
  <SelectInput source="status" label="ステータス" choices={tasksStatus} alwaysOn />,
];

/**
 * ステータスフィールド（色付きチップ）
 */
// const StatusField = () => {
//   const record = useRecordContext<FetchLog>();
//   if (!record) return null;

//   const statusColors: Record<FetchLog['status'], 'success' | 'warning' | 'error'> = {
//     success: 'success',
//     partial: 'warning',
//     failure: 'error',
//   };

//   return <Chip label={record.status} color={statusColors[record.status]} size="small" />;
// };

// /**
//  * プロバイダーフィールド（色付きチップ）
//  */
// const ProviderField = () => {
//   const record = useRecordContext<FetchLog>();
//   if (!record) return null;

//   const providerColors: Record<FetchLog['provider'], 'primary' | 'secondary' | 'default'> = {
//     newsapi: 'primary',
//     gnews: 'secondary',
//     apitube: 'default',
//   };

//   return <Chip label={record.provider} color={providerColors[record.provider]} size="small" />;
// };

/**
 * FetchLog リスト
 */
const list = () => (
  <InfiniteList filters={filters} sort={{ field: 'executedAt', order: 'DESC' }} actions={false}>
    <Datagrid rowClick="show" bulkActionButtons={false}>
      <ProviderField source="provider" label="プロバイダー" />
      <SelectField source="status" choices={tasksStatus} />
      <NumberField source="fetchedCount" label="新規追加" />
      <NumberField source="duplicateCount" label="重複" />
      <NumberField source="failedCount" label="エラー" />
      <DateTimeField source="executedAt" label="実行日時" />
      <DateTimeField source="createdAt" label="作成日時" />
    </Datagrid>
  </InfiniteList>
);

/**
 * FetchLog 詳細
 */
const show = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <ProviderField source="provider" label="プロバイダー" />
      <SelectField source="status" choices={tasksStatus} />
      <NumberField source="fetchedCount" label="新規追加件数" />
      <NumberField source="duplicateCount" label="重複件数" />
      <NumberField source="failedCount" label="エラー件数" />
      <TextField source="errorMessage" label="エラーメッセージ" />
      <DateTimeField source="executedAt" label="実行日時" />
      <FunctionField
        label="TTL"
        render={(record: FetchLog) => {
          if (!record.ttl) return '-';
          const date = new Date(record.ttl * 1000);
          return date.toLocaleString('ja-JP');
        }}
      />
      <DateTimeField source="createdAt" label="作成日時" />
      <DateTimeField source="updatedAt" label="更新日時" />
    </SimpleShowLayout>
  </Show>
);

/**
 * FetchLog リソース設定
 */
export const fetchLogResource = {
  name: 'fetchLogs',
  list,
  show,
  recordRepresentation: (record: FetchLog) => `${record.provider} - ${record.executedAt}`,
  options: { label: 'Fetch履歴' },
};
