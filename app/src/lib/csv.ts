export type CsvCol = { key: string; label: string };

export function downloadCsv(filename: string, cols: CsvCol[], rows: Record<string, unknown>[]): void {
  const cell = (value: unknown) => {
    let l = String(value ?? "");
    // Beskyt mod formel-injektion i Excel
    if (/^[=+\-@\t\r]/.test(l)) {
      l = "'" + l;
    }
    return `"${l.replace(/"/g, "\"\"")}"`;
  };
  const lines = [cols.map(c => cell(c.label)).join(";"), ...rows.map(row => cols.map(c => cell(row[c.key])).join(";"))];
  const blob = new Blob(["﻿" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
