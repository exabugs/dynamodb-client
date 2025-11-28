/**
 * Tasks リソースコンポーネント
 * List, Create, Edit, Show を一つのファイルで管理
 *
 * 機能:
 * - List: Datagrid表示、ページネーション、ソート、フィルター
 * - Create: タスク作成フォーム
 * - Edit: タスク編集フォーム
 * - Show: タスク詳細表示
 *
 * 要件: 2.1, 2.5
 */
import icon from '@mui/icons-material/Task';

import {
  Create,
  Edit,
  InfiniteList,
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

const status_choices = [
  { id: 'todo', name: 'TODO' },
  { id: 'in_progress', name: '進行中' },
  { id: 'done', name: '完了' },
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
 * - "status" → status = 値（eq、string、デフォルト）
 * - "name:starts" → name が値で始まる
 * - "dueDate:gte:date" → dueDate >= 値
 *
 * 要件: 12.12
 */
const filters = [
  // 基本フィルター（等価比較）
  <SelectInput source="status" label="ステータス" choices={status_choices} alwaysOn />,

  // 前方一致フィルター
  <TextInput source="name:starts" label="名前（前方一致）" alwaysOn />,

  // 期限日時範囲フィルター
  <DateTimeInput source="dueDate:gte:date" label="期限日時（以降）" alwaysOn />,
  <DateTimeInput source="dueDate:lte:date" label="期限日時（以前）" alwaysOn />,
];

// ========================================
// List
// ========================================

/**
 * TaskList コンポーネント
 *
 * デフォルトソート: createdAt DESC（最新作成順）
 * ページネーション: nextToken ベース（無限スクロール）
 *
 * 無限スクロールを使用する理由:
 * - 複数フィルター適用時、クライアント側フィルタリングにより実際の取得件数が変動する
 * - 通常のページネーション（1,2,3...）では、ページごとの件数が不安定になる
 * - 無限スクロールなら、スクロールするたびに追加データを取得し、自然なUXを提供できる
 */
const list = () => (
  <InfiniteList filters={filters} sort={{ field: 'createdAt', order: 'DESC' }}>
    <Datagrid rowClick="edit">
      <TextField source="name" />
      <TextField source="status" />
      <DateTimeField source="dueDate" />
      <DateTimeField source="createdAt" />
      <DateTimeField source="updatedAt" />
    </Datagrid>
  </InfiniteList>
);

// ========================================
// Create
// ========================================

/**
 * TaskCreate コンポーネント
 * タスク作成フォーム
 */
const create = () => (
  <Create>
    <SimpleForm>
      <TextInput source="name" validate={[required()]} fullWidth />
      <SelectInput
        source="status"
        choices={status_choices}
        defaultValue="todo"
        validate={[required()]}
      />
      <DateTimeInput source="dueDate" />
      <TextInput source="assignee" />
      <TextInput source="description" multiline rows={4} fullWidth />
    </SimpleForm>
  </Create>
);

// ========================================
// Edit
// ========================================

/**
 * TaskEdit コンポーネント
 * タスク編集フォーム
 */
const edit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="id" disabled />
      <TextInput source="name" validate={[required()]} fullWidth />
      <SelectInput source="status" choices={status_choices} validate={[required()]} />
      <DateTimeInput source="dueDate" />
      <TextInput source="assignee" />
      <TextInput source="description" multiline rows={4} fullWidth />
      <DateTimeInput source="createdAt" disabled />
      <DateTimeInput source="updatedAt" disabled />
    </SimpleForm>
  </Edit>
);

// ========================================
// Show
// ========================================

/**
 * TaskShow コンポーネント
 * タスク詳細表示
 */
const show = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" />
      <TextField source="name" />
      <TextField source="status" />
      <DateTimeField source="dueDate" />
      <TextField source="assignee" />
      <TextField source="description" />
      <DateTimeField source="createdAt" />
      <DateTimeField source="updatedAt" />
    </SimpleShowLayout>
  </Show>
);

export default {
  name: 'tasks',
  list,
  show,
  create,
  edit,
  recordRepresentation: 'name',
  icon,
};
