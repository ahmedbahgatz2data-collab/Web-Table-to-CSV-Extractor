import XLSX from 'xlsx-js-style';
import { ExtractedTable } from '../types/table.js';
import { sanitizeFilename } from './csvExporter.js';

/**
 * Downloads binary content as a valid .xlsx file in the browser
 */
function downloadBinaryFile(data: Uint8Array, filename: string): void {
  const blob = new Blob([data.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
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
 * Creates an XLSX Worksheet with fully valid styles (colors, headers, borders)
 */
function createStyledWorksheet(table: ExtractedTable, includeSourceColumns: boolean = false, sourceMeta?: { url: string; pageTitle: string }[]): XLSX.WorkSheet {
  const hasTags = table.rowStyles && table.rowStyles.some(s => s?.tag || s?.hexBg);
  
  let headers: string[];
  let rows: string[][];
  let rowStylesList = table.rowStyles || [];

  if (includeSourceColumns && sourceMeta) {
    headers = ['source_url', 'page_title', 'table_name', ...(hasTags ? [...table.headers, 'status_tag'] : table.headers)];
    rows = table.rows.map((row, idx) => {
      const meta = sourceMeta[idx] || { url: '', pageTitle: '' };
      const tag = rowStylesList[idx]?.tag || '';
      const baseRow = hasTags ? [...row, tag] : row;
      return [meta.url, meta.pageTitle, table.name, ...baseRow];
    });
  } else {
    headers = hasTags ? [...table.headers, 'status_tag'] : table.headers;
    rows = table.rows.map((row, idx) => {
      const tag = rowStylesList[idx]?.tag || '';
      return hasTags ? [...row, tag] : row;
    });
  }

  const allData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(allData);

  const numCols = headers.length;
  const numRows = rows.length;

  // Auto column widths
  const colWidths = headers.map((h, colIdx) => {
    let maxLen = (h || '').toString().length;
    for (let r = 0; r < Math.min(numRows, 100); r++) {
      const cellVal = rows[r]?.[colIdx] ?? '';
      maxLen = Math.max(maxLen, cellVal.toString().length);
    }
    return { wch: Math.min(Math.max(maxLen + 3, 12), 50) };
  });
  ws['!cols'] = colWidths;

  // Header Style
  const headerStyle = {
    fill: { patternType: 'solid', fgColor: { rgb: '2B4C7E' } },
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: 'D9D9D9' } },
      bottom: { style: 'medium', color: { rgb: '1B355A' } },
      left: { style: 'thin', color: { rgb: 'D9D9D9' } },
      right: { style: 'thin', color: { rgb: 'D9D9D9' } },
    },
  };

  const defaultBorder = {
    top: { style: 'thin', color: { rgb: 'E2E8F0' } },
    bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
    left: { style: 'thin', color: { rgb: 'E2E8F0' } },
    right: { style: 'thin', color: { rgb: 'E2E8F0' } },
  };

  // Apply header styling (row 0)
  for (let c = 0; c < numCols; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cellRef]) ws[cellRef] = { t: 's', v: headers[c] || '' };
    ws[cellRef].s = headerStyle;
  }

  // Apply row styling and colors
  for (let r = 0; r < numRows; r++) {
    const rowStyle = rowStylesList[r];
    const hexBg = rowStyle?.hexBg;
    const hexColor = rowStyle?.hexColor;
    const isZebra = r % 2 === 1;
    const zebraBg = isZebra ? 'F8FAFC' : 'FFFFFF';

    for (let c = 0; c < numCols; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: r + 1, c });
      if (!ws[cellRef]) {
        ws[cellRef] = { t: 's', v: rows[r]?.[c] ?? '' };
      }

      if (hexBg) {
        ws[cellRef].s = {
          fill: { patternType: 'solid', fgColor: { rgb: hexBg } },
          font: { name: 'Calibri', sz: 10, bold: Boolean(hexColor), color: { rgb: hexColor || '000000' } },
          alignment: { vertical: 'center', wrapText: false },
          border: defaultBorder,
        };
      } else {
        ws[cellRef].s = {
          fill: { patternType: 'solid', fgColor: { rgb: zebraBg } },
          font: { name: 'Calibri', sz: 10, color: { rgb: '1E293B' } },
          alignment: { vertical: 'center', wrapText: false },
          border: defaultBorder,
        };
      }
    }
  }

  return ws;
}

/**
 * Exports a single ExtractedTable to a formatted Excel .xlsx file with colors preserved
 */
export function exportTableToXlsx(table: ExtractedTable, customFileName?: string): void {
  const wb = XLSX.utils.book_new();
  const ws = createStyledWorksheet(table);

  const sheetName = sanitizeFilename(table.name || 'Table').slice(0, 31) || 'Sheet1';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const excelBuffer = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
  });

  const filename = customFileName || `${sanitizeFilename(table.name || 'table')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  downloadBinaryFile(new Uint8Array(excelBuffer), filename);
}

/**
 * Exports batch items to a styled Excel .xlsx workbook
 */
export function exportBatchToXlsx(
  items: { url: string; pageTitle?: string; tables: ExtractedTable[] }[],
  customFileName?: string
): void {
  const wb = XLSX.utils.book_new();
  const successItems = items.filter(it => it.tables && it.tables.length > 0);
  if (successItems.length === 0) return;

  // 1. Build Merged Master Sheet
  const headerSet = new Set<string>();
  successItems.forEach(it => {
    it.tables.forEach(t => {
      t.headers.forEach(h => {
        if (h && h.trim()) headerSet.add(h.trim());
      });
    });
  });
  const customHeaders = Array.from(headerSet);
  const masterHeaders = ['source_url', 'page_title', 'table_name', 'status_tag', ...customHeaders];

  const masterRows: string[][] = [];
  const masterRowStyles: { hexBg?: string; hexColor?: string; tag?: string }[] = [];

  successItems.forEach(it => {
    it.tables.forEach(t => {
      const colMap = new Map<string, number>();
      t.headers.forEach((h, idx) => colMap.set(h.trim(), idx));

      t.rows.forEach((row, rIdx) => {
        const rowStyle = t.rowStyles?.[rIdx];
        const statusTag = rowStyle?.tag || '';

        const rowCells: string[] = [
          it.url,
          it.pageTitle || 'Web Page',
          t.name || 'Table',
          statusTag,
        ];

        customHeaders.forEach(col => {
          const originalIdx = colMap.get(col);
          rowCells.push(originalIdx !== undefined ? row[originalIdx] ?? '' : '');
        });

        masterRows.push(rowCells);
        masterRowStyles.push({
          hexBg: rowStyle?.hexBg,
          hexColor: rowStyle?.hexColor,
          tag: statusTag,
        });
      });
    });
  });

  const masterTable: ExtractedTable = {
    id: 'merged-master',
    index: 0,
    name: 'Merged All Tables',
    headers: masterHeaders,
    rows: masterRows,
    rowStyles: masterRowStyles,
    rowCount: masterRows.length,
    colCount: masterHeaders.length,
  };

  const masterWs = createStyledWorksheet(masterTable);
  XLSX.utils.book_append_sheet(wb, masterWs, 'Merged All Tables');

  // 2. Append individual worksheets with source meta
  let sheetCount = 0;
  successItems.forEach((it, itIdx) => {
    it.tables.forEach((t, tIdx) => {
      if (sheetCount >= 25) return;
      const sourceMeta = t.rows.map(() => ({ url: it.url, pageTitle: it.pageTitle || 'Web Page' }));
      const ws = createStyledWorksheet(t, true, sourceMeta);

      const baseName = sanitizeFilename(`${itIdx + 1}_${t.name || `T${tIdx + 1}`}`).slice(0, 28);
      const uniqueName = `${baseName}_${sheetCount + 1}`.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, uniqueName);
      sheetCount++;
    });
  });

  const excelBuffer = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
  });

  const filename = customFileName || `batch_tables_styled_${new Date().toISOString().slice(0, 10)}.xlsx`;
  downloadBinaryFile(new Uint8Array(excelBuffer), filename);
}

/**
 * Exports all tables matching a specific title across batch items to a styled Excel .xlsx file with colors preserved
 */
export function exportTablesByTitleToXlsx(
  items: { url: string; pageTitle?: string; tables: ExtractedTable[] }[],
  targetTitle: string,
  customFileName?: string
): void {
  const targetLower = targetTitle.toLowerCase().trim();
  const successItems = items.filter(it => it.tables && it.tables.length > 0);
  if (successItems.length === 0) return;

  const matchedTables: { url: string; pageTitle: string; table: ExtractedTable }[] = [];
  successItems.forEach(it => {
    it.tables.forEach(t => {
      if (t.name.toLowerCase().trim() === targetLower) {
        matchedTables.push({ url: it.url, pageTitle: it.pageTitle || 'Web Page', table: t });
      }
    });
  });

  if (matchedTables.length === 0) return;

  const wb = XLSX.utils.book_new();

  // Master sheet for this specific title
  const headerSet = new Set<string>();
  matchedTables.forEach(m => {
    m.table.headers.forEach(h => {
      if (h && h.trim()) headerSet.add(h.trim());
    });
  });
  const customHeaders = Array.from(headerSet);
  const titleHeaders = ['source_url', 'page_title', 'table_name', 'status_tag', ...customHeaders];

  const titleRows: string[][] = [];
  const titleRowStyles: { hexBg?: string; hexColor?: string; tag?: string }[] = [];

  matchedTables.forEach(m => {
    const colMap = new Map<string, number>();
    m.table.headers.forEach((h, idx) => colMap.set(h.trim(), idx));

    m.table.rows.forEach((row, rIdx) => {
      const rowStyle = m.table.rowStyles?.[rIdx];
      const statusTag = rowStyle?.tag || '';

      const rowCells: string[] = [
        m.url,
        m.pageTitle,
        m.table.name,
        statusTag,
      ];

      customHeaders.forEach(col => {
        const originalIdx = colMap.get(col);
        rowCells.push(originalIdx !== undefined ? row[originalIdx] ?? '' : '');
      });

      titleRows.push(rowCells);
      titleRowStyles.push({
        hexBg: rowStyle?.hexBg,
        hexColor: rowStyle?.hexColor,
        tag: statusTag,
      });
    });
  });

  const titleTable: ExtractedTable = {
    id: 'title-master',
    index: 0,
    name: targetTitle,
    headers: titleHeaders,
    rows: titleRows,
    rowStyles: titleRowStyles,
    rowCount: titleRows.length,
    colCount: titleHeaders.length,
  };

  const ws = createStyledWorksheet(titleTable);
  XLSX.utils.book_append_sheet(wb, ws, sanitizeFilename(targetTitle).slice(0, 31) || 'Table');

  const excelBuffer = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
  });

  const filename = customFileName || `merged_batch_${sanitizeFilename(targetTitle)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  downloadBinaryFile(new Uint8Array(excelBuffer), filename);
}
