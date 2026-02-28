import * as cheerio from "cheerio";

export interface TableRow {
  [column: string]: string;
}

/**
 * Extracts all rows from an HTML table element.
 * Handles colspan and rowspan naively (takes first cell text).
 */
export function parseHtmlTable(
  tableHtml: string,
  headerRowIndex = 0
): TableRow[] {
  const $ = cheerio.load(tableHtml);
  const table = $("table").first();
  const rows = table.find("tr").toArray();

  if (rows.length <= headerRowIndex) return [];

  // Extract headers from the designated row
  const headerRow = rows[headerRowIndex];
  const headers = $(headerRow)
    .find("th, td")
    .toArray()
    .map((el) => $(el).text().trim());

  const result: TableRow[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const cells = $(rows[i])
      .find("td")
      .toArray()
      .map((el) => $(el).text().trim());

    if (cells.length === 0) continue;

    const row: TableRow = {};
    headers.forEach((header, idx) => {
      row[header] = cells[idx] ?? "";
    });
    result.push(row);
  }

  return result;
}

/**
 * Extracts ALL tables from an HTML document, returning arrays of rows.
 */
export function parseAllTables(html: string): TableRow[][] {
  const $ = cheerio.load(html);
  const tables: TableRow[][] = [];

  $("table").each((_, tableEl) => {
    const tableHtml = $.html(tableEl);
    const rows = parseHtmlTable(tableHtml);
    if (rows.length > 0) tables.push(rows);
  });

  return tables;
}
