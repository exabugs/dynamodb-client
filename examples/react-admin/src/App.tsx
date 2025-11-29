import { Admin, Resource } from 'react-admin';
import { dataProvider } from './dataProvider';
import { authProvider } from './authProvider';
import { ArticleList, ArticleCreate, ArticleEdit, ArticleShow } from './resources/articles';

/**
 * Main App Component
 */
export const App = () => {
  return (
    <Admin dataProvider={dataProvider} authProvider={authProvider}>
      <Resource
        name="articles"
        list={ArticleList}
        create={ArticleCreate}
        edit={ArticleEdit}
        show={ArticleShow}
      />
    </Admin>
  );
};
