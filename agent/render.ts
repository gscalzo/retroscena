/** Terminal shapes: a padded table and a readable time. */

/** Rows of equal length; columns padded to their widest cell, no trailing blanks. */
export function table(rows: readonly (readonly string[])[]): string {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  return `${rows
    .map((r) =>
      r
        .map((cell, i) => cell.padEnd(widths[i]))
        .join('  ')
        .trimEnd(),
    )
    .join('\n')}\n`;
}

/** An epoch as "2026-09-04 16:02:00" (UTC). */
export function fmtTime(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 19).replace('T', ' ');
}
