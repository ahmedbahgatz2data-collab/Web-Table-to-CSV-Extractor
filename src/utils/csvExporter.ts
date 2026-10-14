import { ExtractedTable, CsvExportOptions } from '../types/table.js';

/**
 * Format a single cell value for CSV/TSV according to RFC 4180
 */
export function formatCsvCell(value: string, delimiter: string = ',', alwaysQuote: boolean = false): string {
  if (value === null || value === undefined) return '';
  const str = String(value);

  // Check if quoting is required
  const needsQuotes =
    alwaysQuote ||
    str.includes(delimiter) ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r') ||
    str.startsWith(' ') ||
    str.endsWith(' ');

  if (needsQuotes) {
    // Escape double quotes by doubling them
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Converts an ExtractedTable to a CSV string with optional UTF-8 BOM
 */
export function tableToCsv(
  table: ExtractedTable,
  options: Partial<CsvExportOptions> = {}
): string {
  const delimiter = options.delimiter || ',';
  const includeBom = options.includeBom ?? true;
  const quoteStrings = options.quoteStrings ?? false;

  const lines: string[] = [];

  // Header row
  if (table.headers && table.headers.length > 0) {
    const headerLine = table.headers
      .map(h => formatCsvCell(h, delimiter, quoteStrings))
      .join(delimiter);
    lines.push(headerLine);
  }

  // Data rows
  for (const row of table.rows) {
    const rowLine = row
      .map(cell => formatCsvCell(cell, delimiter, quoteStrings))
      .join(delimiter);
    lines.push(rowLine);
  }

  const csvContent = lines.join('\r\n');
  return includeBom ? '\uFEFF' + csvContent : csvContent;
}

/**
 * Converts an ExtractedTable to TSV format for direct paste into Excel or Google Sheets
 */
export function tableToTsv(table: ExtractedTable): string {
  const lines: string[] = [];
  if (table.headers && table.headers.length > 0) {
    lines.push(table.headers.map(h => h.replace(/\t/g, ' ')).join('\t'));
  }
  for (const row of table.rows) {
    lines.push(row.map(cell => cell.replace(/\t/g, ' ')).join('\t'));
  }
  return lines.join('\n');
}

/**
 * Converts an ExtractedTable to a formatted JSON array of objects
 */
export function tableToJson(table: ExtractedTable): string {
  const result = table.rows.map(row => {
    const obj: Record<string, string> = {};
    table.headers.forEach((header, index) => {
      const key = header || `col_${index + 1}`;
      obj[key] = row[index] ?? '';
    });
    return obj;
  });
  return JSON.stringify(result, null, 2);
}

/**
 * Converts an ExtractedTable to Markdown table format
 */
export function tableToMarkdown(table: ExtractedTable): string {
  if (!table.headers || table.headers.length === 0) return '';
  const lines: string[] = [];

  // Header
  lines.push(`| ${table.headers.map(h => h.replace(/\|/g, '\\|').trim()).join(' | ')} |`);
  // Separator
  lines.push(`| ${table.headers.map(() => '---').join(' | ')} |`);
  // Rows
  for (const row of table.rows) {
    lines.push(`| ${row.map(cell => cell.replace(/\|/g, '\\|').trim()).join(' | ')} |`);
  }
  return lines.join('\n');
}

/**
 * Sanitizes a string for use as a file name
 */
export function sanitizeFilename(name: string, fallback: string = 'extracted_table'): string {
  if (!name) return fallback;
  // Replace illegal filename characters
  const clean = name.replace(/[/\\?%*:|"<>]/g, '_').trim().slice(0, 60);
  return clean || fallback;
}

/**
 * Initiates a browser file download
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Creates a single unified merged CSV across multiple batch-extracted tables
 */
export function createMergedCsv(
  items: { url: string; pageTitle?: string; tables: ExtractedTable[] }[],
  options: Partial<CsvExportOptions> = {}
): string {
  const delimiter = options.delimiter || ',';
  const includeBom = options.includeBom ?? true;
  const quoteStrings = options.quoteStrings ?? false;

  // 1. Collect all tables from all items
  const allTableEntries: {
    sourceUrl: string;
    pageTitle: string;
    table: ExtractedTable;
  }[] = [];

  for (const item of items) {
    for (const table of item.tables) {
      if (table.rows.length > 0) {
        allTableEntries.push({
          sourceUrl: item.url,
          pageTitle: item.pageTitle || 'Web Page',
          table,
        });
      }
    }
  }

  if (allTableEntries.length === 0) {
    return includeBom ? '\uFEFF' : '';
  }

  // 2. Discover all unique column headers across all tables
  const headerSet = new Set<string>();
  for (const entry of allTableEntries) {
    for (const h of entry.table.headers) {
      if (h.trim()) headerSet.add(h.trim());
    }
  }

  const customHeaders = Array.from(headerSet);
  // Standard prefix columns
  const standardPrefixHeaders = ['source_url', 'page_title', 'table_name'];
  const fullHeaders = [...standardPrefixHeaders, ...customHeaders];

  const lines: string[] = [];

  // Write header row
  lines.push(
    fullHeaders
      .map(h => formatCsvCell(h, delimiter, quoteStrings))
      .join(delimiter)
  );

  // Write rows mapped to fullHeaders
  for (const entry of allTableEntries) {
    const colIndexMap = new Map<string, number>();
    entry.table.headers.forEach((h, idx) => {
      colIndexMap.set(h.trim(), idx);
    });

    for (const row of entry.table.rows) {
      const rowValues: string[] = [
        entry.sourceUrl,
        entry.pageTitle,
        entry.table.name || 'Table',
      ];

      for (const col of customHeaders) {
        const originalIndex = colIndexMap.get(col);
        const cellVal = originalIndex !== undefined ? row[originalIndex] ?? '' : '';
        rowValues.push(cellVal);
      }

      lines.push(
        rowValues
          .map(cell => formatCsvCell(cell, delimiter, quoteStrings))
          .join(delimiter)
      );
    }
  }

  const content = lines.join('\r\n');
  return includeBom ? '\uFEFF' + content : content;
}

/**
 * Creates a merged CSV for a specific table name across batch items from scratch.
 * Filters items for tables matching targetTitle and merges them using the robust createMergedCsv logic.
 */
export function createMergedCsvByTableTitle(
  items: { url: string; pageTitle?: string; tables: ExtractedTable[] }[],
  targetTitle: string,
  options: Partial<CsvExportOptions> = {}
): string {
  const targetLower = targetTitle.toLowerCase().trim();

  // Filter items to only include tables that match the target table title/name
  const filteredItems = items
    .map(item => ({
      ...item,
      tables: item.tables.filter(t => t.name.toLowerCase().trim() === targetLower)
    }))
    .filter(item => item.tables.length > 0);

  if (filteredItems.length === 0) {
    return options.includeBom ?? true ? '\uFEFF' : '';
  }

  return createMergedCsv(filteredItems, options);
}
