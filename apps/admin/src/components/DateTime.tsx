//
// DateTime
//
import dayjs from 'dayjs';

import { DateTimeInput as RADateTimeInput, useListContext, useRecordContext } from 'react-admin';

export const DateTimeField = ({
  source, //
}: {
  source: string;
  label?: string;
}) => {
  // リストコンテキスト外で使用される場合があるため、try-catchで保護
  let listContext;
  try {
    listContext = useListContext();
  } catch {
    listContext = null;
  }

  const record = useRecordContext();
  if (!record) return null;
  const val = record[source];
  if (!val) return null;
  const format = listContext ? 'MM/DD HH:mm' : 'YYYY/MM/DD HH:mm';
  return <span>{dayjs(val).format(format)}</span>;
};

// カスタム DateTimeInput コンポーネント
// ５分間隔で選択できるようにしたいが、できないみたいだ。
export const DateTimeInput = ({
  ...props //
}: {
  source: string;
  validate?: ((value: unknown) => string | undefined) | ((value: unknown) => string | undefined)[];
  label?: string;
  disabled?: boolean;
  alwaysOn?: boolean;
}) => {
  return (
    <RADateTimeInput
      {...props}
      // InputProps={{
      //   inputProps: {
      //     minutesStep: 5, // 5分間隔
      //     // step: 300, // 5分間隔 (300秒)
      //   },
      // }}
    />
  );
};
