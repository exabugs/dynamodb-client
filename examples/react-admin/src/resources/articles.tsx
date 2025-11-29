import {
  List,
  Datagrid,
  TextField,
  DateField,
  Create,
  Edit,
  Show,
  SimpleForm,
  SimpleShowLayout,
  TextInput,
  SelectInput,
  required,
} from 'react-admin';

/**
 * Article List
 */
export const ArticleList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="id" />
      <TextField source="title" />
      <TextField source="status" />
      <TextField source="author" />
      <DateField source="createdAt" showTime />
      <DateField source="updatedAt" showTime />
    </Datagrid>
  </List>
);

/**
 * Article Create
 */
export const ArticleCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="title" validate={required()} fullWidth />
      <TextInput source="content" multiline rows={5} fullWidth />
      <SelectInput
        source="status"
        choices={[
          { id: 'draft', name: 'Draft' },
          { id: 'published', name: 'Published' },
        ]}
        defaultValue="draft"
      />
      <TextInput source="author" validate={required()} />
    </SimpleForm>
  </Create>
);

/**
 * Article Edit
 */
export const ArticleEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="id" disabled />
      <TextInput source="title" validate={required()} fullWidth />
      <TextInput source="content" multiline rows={5} fullWidth />
      <SelectInput
        source="status"
        choices={[
          { id: 'draft', name: 'Draft' },
          { id: 'published', name: 'Published' },
        ]}
      />
      <TextInput source="author" validate={required()} />
      <DateField source="createdAt" showTime />
      <DateField source="updatedAt" showTime />
    </SimpleForm>
  </Edit>
);

/**
 * Article Show
 */
export const ArticleShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" />
      <TextField source="title" />
      <TextField source="content" />
      <TextField source="status" />
      <TextField source="author" />
      <DateField source="createdAt" showTime />
      <DateField source="updatedAt" showTime />
    </SimpleShowLayout>
  </Show>
);
