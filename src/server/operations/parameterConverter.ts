/**
 * MongoDB風APIパラメータの変換ユーティリティ
 *
 * MongoDB風のパラメータを内部形式に変換する共通ロジック
 */
import type {
  DeleteManyParams,
  DeleteOneParams,
  FindManyParams,
  FindOneParams,
  FindParams,
  InsertManyParams,
  InsertOneParams,
  UpdateManyParams,
  UpdateOneParams,
} from '../types.js';

/**
 * MongoDB風のfindパラメータ
 */
interface MongoFindParams {
  filter?: Record<string, unknown>;
  options?: {
    sort?: Record<string, 'asc' | 'desc' | 1 | -1>;
    limit?: number;
    nextToken?: string;
  };
}

/**
 * MongoDB風のフィルタパラメータ
 */
interface MongoFilterParams {
  filter?: {
    id?: string | { $in?: string[] };
  };
}

/**
 * MongoDB風の更新パラメータ
 */
interface MongoUpdateParams extends MongoFilterParams {
  update?:
    | {
        $set?: Record<string, unknown>;
      }
    | Record<string, unknown>;
  options?: {
    upsert?: boolean;
  };
}

/**
 * MongoDB風のドキュメントパラメータ
 */
interface MongoDocumentParams {
  document?: Record<string, unknown>;
}

/**
 * MongoDB風の複数ドキュメントパラメータ
 */
interface MongoDocumentsParams {
  documents?: Array<Record<string, unknown>>;
}

/**
 * MongoDB風のfindパラメータを内部形式に変換する
 *
 * @param mongoParams - MongoDB風のfindパラメータ
 * @returns 内部形式のfindパラメータ
 */
export function convertFindParams(mongoParams: MongoFindParams): FindParams {
  const { filter = {}, options = {} } = mongoParams;
  const { sort, limit, nextToken } = options;

  const internalParams: FindParams = {
    filter,
    ...(sort &&
      Object.keys(sort).length > 0 && {
        sort: {
          field: Object.keys(sort)[0],
          order: Object.values(sort)[0] === 'desc' ? 'DESC' : 'ASC',
        },
      }),
    ...((limit || nextToken) && {
      pagination: {
        ...(limit && { perPage: limit }),
        ...(nextToken && { nextToken }),
      },
    }),
  };

  return internalParams;
}

/**
 * MongoDB風のfindOneパラメータを内部形式に変換する
 *
 * @param mongoParams - MongoDB風のfindOneパラメータ
 * @returns 内部形式のfindOneパラメータ
 * @throws {Error} filterが指定されていない場合
 */
export function convertFindOneParams(mongoParams: MongoFilterParams): FindOneParams {
  // filterが存在しない場合はエラー
  if (!mongoParams.filter) {
    throw new Error('findOne requires filter');
  }

  // filter.idが存在する場合はidとして使用（後方互換性）
  const id = typeof mongoParams.filter.id === 'string' ? mongoParams.filter.id : undefined;

  if (id) {
    // idが存在する場合は従来通りの形式
    return { id };
  }

  // idが存在しない場合はfilter全体を使用
  return { filter: mongoParams.filter };
}

/**
 * MongoDB風のfindManyパラメータを内部形式に変換する
 *
 * @param mongoParams - MongoDB風のfindManyパラメータ
 * @returns 内部形式のfindManyパラメータ
 * @throws {Error} filterが指定されていない場合
 */
export function convertFindManyParams(mongoParams: MongoFilterParams): FindManyParams {
  // filterが存在しない場合はエラー
  if (!mongoParams.filter) {
    throw new Error('findMany requires filter');
  }

  const idFilter = mongoParams.filter.id;

  // filter.id.$inが存在する場合はidsとして使用（後方互換性）
  if (typeof idFilter === 'object' && idFilter !== null && '$in' in idFilter) {
    const ids = idFilter.$in || [];
    return { ids };
  }

  // idが存在しない場合はfilter全体を使用
  return { filter: mongoParams.filter };
}

/**
 * MongoDB風のinsertOneパラメータを内部形式に変換する
 *
 * @param mongoParams - MongoDB風のinsertOneパラメータ
 * @returns 内部形式のinsertOneパラメータ
 * @throws {Error} documentが指定されていない場合
 */
export function convertInsertOneParams(mongoParams: MongoDocumentParams): InsertOneParams {
  if (!mongoParams.document) {
    throw new Error('insertOne requires document');
  }
  return {
    data: mongoParams.document,
  };
}

/**
 * MongoDB風のupdateOneパラメータを内部形式に変換する
 *
 * @param mongoParams - MongoDB風のupdateOneパラメータ
 * @returns 内部形式のupdateOneパラメータ
 * @throws {Error} idまたはfilterが指定されていない場合
 */
export function convertUpdateOneParams(mongoParams: MongoUpdateParams): UpdateOneParams {
  // filterが存在しない場合はエラー
  if (!mongoParams.filter) {
    throw new Error('updateOne requires filter');
  }

  // 更新データを抽出（$set と $setOnInsert を両方含める）
  let updateData: Record<string, unknown>;

  if (mongoParams.update && typeof mongoParams.update === 'object') {
    if ('$set' in mongoParams.update || '$setOnInsert' in mongoParams.update) {
      // UpdateOperators形式の場合、update全体を渡す（handleUpdateOneで処理）
      updateData = mongoParams.update as Record<string, unknown>;
    } else {
      // 通常のパッチ形式
      updateData = mongoParams.update as Record<string, unknown>;
    }
  } else {
    updateData = {};
  }

  // filter.idが存在する場合はidとして使用（後方互換性）
  const id = typeof mongoParams.filter.id === 'string' ? mongoParams.filter.id : undefined;

  if (id) {
    // idが存在する場合は従来通りの形式
    return {
      id,
      data: updateData,
      options: mongoParams.options,
    };
  }

  // idが存在しない場合はfilter全体を使用
  return {
    filter: mongoParams.filter,
    data: updateData,
    options: mongoParams.options,
  };
}

/**
 * MongoDB風のupdateManyパラメータを内部形式に変換する
 *
 * @param mongoParams - MongoDB風のupdateManyパラメータ
 * @returns 内部形式のupdateManyパラメータ
 */
export function convertUpdateManyParams(mongoParams: MongoUpdateParams): UpdateManyParams {
  const idFilter = mongoParams.filter?.id;
  const ids =
    typeof idFilter === 'object' && idFilter !== null && '$in' in idFilter
      ? idFilter.$in || []
      : [];
  const updateData: Record<string, unknown> =
    mongoParams.update && typeof mongoParams.update === 'object'
      ? '$set' in mongoParams.update
        ? (mongoParams.update.$set as Record<string, unknown>) || {}
        : (mongoParams.update as Record<string, unknown>)
      : {};
  return {
    ids,
    data: updateData,
    options: mongoParams.options,
  };
}

/**
 * MongoDB風のdeleteOneパラメータを内部形式に変換する
 *
 * @param mongoParams - MongoDB風のdeleteOneパラメータ
 * @returns 内部形式のdeleteOneパラメータ
 * @throws {Error} idが指定されていない場合
 */
export function convertDeleteOneParams(mongoParams: MongoFilterParams): DeleteOneParams {
  const id = typeof mongoParams.filter?.id === 'string' ? mongoParams.filter.id : undefined;
  if (!id) {
    throw new Error('deleteOne requires filter.id');
  }
  return { id };
}

/**
 * MongoDB風のdeleteManyパラメータを内部形式に変換する
 *
 * @param mongoParams - MongoDB風のdeleteManyパラメータ
 * @returns 内部形式のdeleteManyパラメータ
 */
export function convertDeleteManyParams(mongoParams: MongoFilterParams): DeleteManyParams {
  const idFilter = mongoParams.filter?.id;
  const ids =
    typeof idFilter === 'object' && idFilter !== null && '$in' in idFilter
      ? idFilter.$in || []
      : [];
  return { ids };
}

/**
 * MongoDB風のinsertManyパラメータを内部形式に変換する
 *
 * @param mongoParams - MongoDB風のinsertManyパラメータ
 * @returns 内部形式のinsertManyパラメータ
 * @throws {Error} documentsが指定されていない場合
 */
export function convertInsertManyParams(mongoParams: MongoDocumentsParams): InsertManyParams {
  if (!mongoParams.documents) {
    throw new Error('insertMany requires documents');
  }
  return {
    data: mongoParams.documents,
  };
}
