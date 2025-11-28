//
// Provider
//
import type { ReactElement } from 'react';
import { SelectField, SelectInput } from 'react-admin';

const choices = [
  { id: 'newsapi', name: 'newsapi' },
  { id: 'gnews', name: 'gnews' },
  { id: 'apitube', name: 'apitube' },
];

export const ProviderField = ({
  ...props //
}: {
  source: string;
  label?: string;
}): ReactElement => <SelectField choices={choices} {...props} />;

export const ProviderInput = ({
  ...props //
}: {
  source: string;
  label?: string;
  alwaysOn?: boolean;
}): ReactElement => <SelectInput choices={choices} {...props} />;
