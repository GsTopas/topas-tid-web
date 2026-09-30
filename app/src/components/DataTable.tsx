import type { ReactNode } from "react";

export type Col = { key: string; label: string; num?: boolean };

/** En tabelrække: celleværdier pr. kolonnenøgle, evt. `_cls` med ekstra className pr. celle. */
export type Row = { [key: string]: ReactNode | Record<string, string> | undefined; _cls?: Record<string, string> };

type Props = {
  cols: Col[];
  rows: Row[];
  footer?: Record<string, ReactNode> | null | false;
};

export function DataTable({ cols, rows, footer }: Props) {
  return <div className="tablewrap"><table className="datatable"><thead><tr>{cols.map(c => <th className={c.num ? "num" : ""} key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{cols.map(c => {
            return <td className={(c.num ? "num " : "") + (row._cls?.[c.key] || "")} key={c.key}>{row[c.key] as ReactNode}</td>;
          })}</tr>)}{footer && <tr className="foot">{cols.map(c => <td className={c.num ? "num" : ""} key={c.key}>{footer[c.key]}</td>)}</tr>}</tbody></table></div>;
}
