/**
 * Articles リソースコンポーネント
 * List, Create, Edit, Show を一つのファイルで管理
 *
 * 機能:
 * - List: Datagrid表示、ページネーション、ソート、フィルター
 * - Create: 記事作成フォーム
 * - Edit: 記事編集フォーム
 * - Show: 記事詳細表示
 *
 * 要件: 2.1, 2.5
 */
import icon from '@mui/icons-material/Article';

import {
  Create,
  Edit,
  InfiniteList,
  SelectField,
  SelectInput,
  Show,
  SimpleForm,
  SimpleShowLayout,
  TextField,
  TextInput,
  required,
} from 'react-admin';

import { Datagrid } from '../components/Datagrid';
import { DateTimeField, DateTimeInput } from '../components/DateTime';
import { ProviderField, ProviderInput } from '../components/Provider';

// 🔴🟠🟡🟢🔵🟣🟤⚫⚪
const status_choices = [
  { id: 'draft', name: '🔵 下書き' },
  { id: 'published', name: '🟢 公開' },
  { id: 'archived', name: '🟤 アーカイブ' },
];

const language_choices = [
  { id: 'en', name: '英語' },
  { id: 'ja', name: '日本語' },
  { id: 'es', name: 'スペイン語' },
  { id: 'fr', name: 'フランス語' },
  { id: 'de', name: 'ドイツ語' },
  { id: 'zh', name: '中国語' },
];

// ========================================
// フィルター
// ========================================

/**
 * フィルター定義
 *
 * 拡張フィールド構文を使用:
 * - フィールド名:オペレータ:型
 * - オペレータ: eq, lt, le, gt, ge, starts, ends
 * - 型: string, number, date, boolean
 *
 * 例:
 * - "category" → category = 値（eq、string、デフォルト）
 * - "name:starts" → name が値で始まる
 * - "createdAt:gte:date" → createdAt >= 値
 *
 * 要件: 12.12
 */
const filters = [
  // 基本フィルター（等価比較）
  <ProviderInput source="provider" label="プロバイダー" alwaysOn />,
  <TextInput source="category" label="カテゴリ" alwaysOn />,
  <SelectInput source="status" label="ステータス" choices={status_choices} alwaysOn />,
  <SelectInput source="language" label="言語" choices={language_choices} />,

  // 前方一致フィルター
  <TextInput source="name:starts" label="タイトル（前方一致）" />,

  // 日時範囲フィルター
  <DateTimeInput source="publishedAt:gte:date" label="公開日時（以降）" />,
  <DateTimeInput source="publishedAt:lte:date" label="公開日時（以前）" />,
  <DateTimeInput source="createdAt:gte:date" label="作成日時（以降）" />,
  <DateTimeInput source="createdAt:lte:date" label="作成日時（以前）" />,
];

// ========================================
// List
// ========================================

/**
 * ArticleList コンポーネント
 *
 * デフォルトソート: updatedAt DESC（最新更新順）
 * ページネーション: nextToken ベース（無限スクロール）
 */
const list = () => (
  <InfiniteList filters={filters} sort={{ field: 'updatedAt', order: 'DESC' }}>
    <Datagrid rowClick="edit">
      <TextField source="name" label="タイトル" />
      <ProviderField source="provider" label="プロバイダー" />
      <TextField source="category" label="カテゴリ" />
      <SelectField source="status" choices={status_choices} label="ステータス" />
      {/* <TextField source="language" label="言語" /> */}
      <TextField source="sourceName" label="ソース" />
      <DateTimeField source="publishedAt" label="公開日時" />
      <DateTimeField source="createdAt" label="作成日時" />
      <DateTimeField source="updatedAt" label="更新日時" />
    </Datagrid>
  </InfiniteList>
);

// ========================================
// Create
// ========================================

/**
 * ArticleCreate コンポーネント
 * 記事作成フォーム
 */
const create = () => (
  <Create>
    <SimpleForm>
      <TextInput source="name" validate={[required()]} />
      <TextInput source="category" validate={[required()]} />
      <SelectInput
        source="status"
        choices={status_choices}
        defaultValue="draft"
        validate={[required()]}
      />
      <TextInput source="no-sort-1" />
    </SimpleForm>
  </Create>
);

// ========================================
// Edit
// ========================================

/**
 * ArticleEdit コンポーネント
 * 記事編集フォーム
 */
const edit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="id" disabled />
      <TextInput source="name" validate={[required()]} />
      <TextInput source="category" validate={[required()]} />
      <SelectInput source="status" choices={status_choices} validate={[required()]} />
      <TextInput source="no-sort-1" />
      <DateTimeInput source="createdAt" label="作成日時" disabled />
      <DateTimeInput source="updatedAt" label="更新日時" disabled />
    </SimpleForm>
  </Edit>
);

// ========================================
// Show
// ========================================

/**
 * ArticleShow コンポーネント
 * 記事詳細表示
 */
export const show = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="name" label="タイトル" />
      <ProviderField source="provider" label="プロバイダー" />
      <TextField source="category" label="カテゴリ" />
      <SelectField source="status" choices={status_choices} label="ステータス" />
      <TextField source="description" label="説明" />
      <TextField source="url" label="URL" />
      <TextField source="imageUrl" label="画像URL" />
      <TextField source="language" label="言語" />
      <TextField source="sourceName" label="ソース名" />
      <TextField source="sourceUrl" label="ソースURL" />
      <DateTimeField source="publishedAt" label="公開日時" />
      <DateTimeField source="createdAt" label="作成日時" />
      <DateTimeField source="updatedAt" label="更新日時" />
    </SimpleShowLayout>
  </Show>
);

export default {
  name: 'articles',
  list,
  show,
  create,
  edit,
  recordRepresentation: 'name',
  icon,
};
