/**
 * Custom Datagrid
 * shadow.config.json の sortableFields に基づいて、各列の sortable プロパティを自動設定
 */
import shadowConfig from '@config/shadow.config.json';

import React, { cloneElement } from 'react';
import {
  Datagrid as RADatagrid,
  DatagridProps as RADatagridProps,
  useResourceContext,
} from 'react-admin';

/**
 * フィールドがソート可能かどうかを判定
 *
 * @param resource - リソース名
 * @param field - フィールド名
 * @returns ソート可能な場合は true
 */
function isSortableField(resource: string | undefined, field: string): boolean {
  // id は常にソート可能
  if (field === 'id') return true;

  if (!resource) return false;

  // shadow.config.json から sortableFields を取得
  const resourceConfig = (
    shadowConfig.resources as Record<string, { shadows?: Record<string, unknown> }>
  )?.[resource];
  if (!resourceConfig) return false;

  return field in (resourceConfig.shadows || {});
}

/**
 * Custom Datagrid
 * shadow.config.json に基づいて sortable プロパティを自動設定
 */
export function Datagrid(props: RADatagridProps) {
  const { children, ...rest } = props;
  const resource = useResourceContext();

  // 各子要素に sortable プロパティを注入
  const decoratedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;

    const source = (child.props as { source?: string })?.source;
    if (!source) return child;

    // shadow.config.json に基づいて sortable を設定
    const sortable = isSortableField(resource, source);
    return cloneElement(child, { sortable } as { sortable: boolean });
  });

  return <RADatagrid {...rest}>{decoratedChildren}</RADatagrid>;
}
