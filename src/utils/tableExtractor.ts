import * as cheerio from 'cheerio';
import { ExtractedTable, ExtractionOptions } from '../types/table.js';
import { detectColorAndHighlight } from './colorUtils.js';

/**
 * Clean text from cell, handling whitespace and nested breaks
 */
function cleanCellText(text: string, cleanWhitespace: boolean = true): string {
  if (!text) return '';
  let cleaned = text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\u00A0/g, ' '); // non-breaking space
  if (cleanWhitespace) {
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  }
  return cleaned;
}

/**
 * Parses an HTML string and extracts all tables with colspan/rowspan grid calculations.
 */
export function extractTablesFromHtml(
  html: string,
  options: Partial<ExtractionOptions> = {}
): { pageTitle: string; tables: ExtractedTable[] } {
  const cleanWhitespace = options.cleanWhitespace ?? true;
  const extractLinks = options.extractLinks ?? false;
  const minRows = options.minRows ?? 1;
  const autoDetectHeaders = options.autoDetectHeaders ?? true;

  const $ = cheerio.load(html);
  const pageTitle = $('title').text().trim() || 'Untitled Page';
  const extractedTables: ExtractedTable[] = [];

  // 1. First process standard <table> elements
  $('table').each((tableIndex, tableElem) => {
    const $table = $(tableElem);

    // Skip nested tables during parent iteration or invisible tables
    // Get table name / caption
    let tableName = '';
    const caption = $table.find('caption').first().text().trim();
    if (caption) {
      tableName = caption;
    } else {
      const ariaLabel = $table.attr('aria-label') || $table.attr('title') || $table.attr('id');
      if (ariaLabel) {
        tableName = ariaLabel;
      } else {
        // Look for preceding heading
        const prevHeading = $table.prevAll('h1, h2, h3, h4, h5, h6, p strong').first().text().trim();
        if (prevHeading && prevHeading.length < 80) {
          tableName = prevHeading;
        } else {
          tableName = `Table ${tableIndex + 1}`;
        }
      }
    }

    // Grid matrix algorithm to handle rowspans and colspans
    const grid: string[][] = [];
    const rowStylesList: { className?: string; color?: string; bgColor?: string; tag?: string; hexBg?: string; hexColor?: string }[] = [];
    const $rows = $table.find('tr');

    $rows.each((rowIndex, rowElem) => {
      const $row = $(rowElem);
      const $cells = $row.find('> th, > td');
      if ($cells.length === 0) return;

      const className = $row.attr('class')?.trim() || '';
      const styleAttr = $row.attr('style')?.trim() || '';
      const bgcolorAttr = $row.attr('bgcolor')?.trim() || '';

      // 1. Detect row-level colors or semantic classes (e.g. NotRecommended, danger, inline style, bgcolor)
      let highlight = detectColorAndHighlight(className, styleAttr, bgcolorAttr);

      // 2. If row itself has no background color, inspect cells in this row to see if cells are colored
      if (!highlight.hexBg) {
        $cells.each((_, cellElem) => {
          if (highlight.hexBg) return;
          const $c = $(cellElem);
          const cClass = $c.attr('class')?.trim() || '';
          const cStyle = $c.attr('style')?.trim() || '';
          const cBg = $c.attr('bgcolor')?.trim() || '';
          const cellHighlight = detectColorAndHighlight(cClass, cStyle, cBg);
          if (cellHighlight.hexBg) {
            highlight = cellHighlight;
          }
        });
      }

      rowStylesList[rowIndex] = {
        className: className || undefined,
        color: highlight.hexColor ? `#${highlight.hexColor}` : undefined,
        bgColor: highlight.hexBg ? `#${highlight.hexBg}` : undefined,
        hexBg: highlight.hexBg || undefined,
        hexColor: highlight.hexColor || undefined,
        tag: highlight.tag || className || undefined,
      };

      let colIndex = 0;
      if (!grid[rowIndex]) {
        grid[rowIndex] = [];
      }

      $cells.each((_, cellElem) => {
        const $cell = $(cellElem);

        // Find next unoccupied slot in current row
        while (grid[rowIndex][colIndex] !== undefined) {
          colIndex++;
        }

        const colspan = Math.max(1, parseInt($cell.attr('colspan') || '1', 10) || 1);
        const rowspan = Math.max(1, parseInt($cell.attr('rowspan') || '1', 10) || 1);

        let cellContent = '';
        if (extractLinks) {
          const $links = $cell.find('a[href]');
          if ($links.length > 0) {
            const linkTexts = $links.map((_, a) => {
              const href = $(a).attr('href') || '';
              const linkText = cleanCellText($(a).text(), cleanWhitespace);
              return href ? `${linkText} [${href}]` : linkText;
            }).get().join('; ');
            cellContent = linkTexts || cleanCellText($cell.text(), cleanWhitespace);
          } else {
            cellContent = cleanCellText($cell.text(), cleanWhitespace);
          }
        } else {
          cellContent = cleanCellText($cell.text(), cleanWhitespace);
        }

        // Fill grid matrix for spanned cells
        for (let r = 0; r < rowspan; r++) {
          const targetRow = rowIndex + r;
          if (!grid[targetRow]) {
            grid[targetRow] = [];
          }
          for (let c = 0; c < colspan; c++) {
            const targetCol = colIndex + c;
            grid[targetRow][targetCol] = cellContent;
          }
        }

        colIndex += colspan;
      });
    });

    // Normalize grid: make all rows have uniform length
    if (!grid || grid.length === 0) return;

    let maxCols = 0;
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      if (row && row.length > maxCols) {
        maxCols = row.length;
      }
    }
    if (maxCols === 0) return;

    // Fill missing positions with empty string, safely handling any sparse array gaps
    const normalizedRows: string[][] = [];
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r] || [];
      const newRow: string[] = [];
      for (let c = 0; c < maxCols; c++) {
        const val = row[c];
        newRow[c] = val !== undefined && val !== null ? String(val) : '';
      }
      normalizedRows.push(newRow);
    }

    // Filter out completely empty rows and track their style indices
    const nonEmptyIndices: number[] = [];
    const nonEmptyRows: string[][] = [];
    normalizedRows.forEach((row, idx) => {
      if (row && row.some(cell => (cell || '').trim().length > 0)) {
        nonEmptyRows.push(row);
        nonEmptyIndices.push(idx);
      }
    });

    if (nonEmptyRows.length < minRows) return;

    // Separate headers from data rows
    let headers: string[] = [];
    let dataRows: string[][] = [];
    let dataRowStyles: { className?: string; color?: string; bgColor?: string; tag?: string; hexBg?: string; hexColor?: string }[] = [];

    // Check if the table has explicit <th> or the first row acts as header
    const hasTheadTh = $table.find('thead th').length > 0 || $table.find('tr:first-child th').length > 0;

    if (autoDetectHeaders && (hasTheadTh || nonEmptyRows.length > 1)) {
      headers = (nonEmptyRows[0] || []).map((h, i) => (h || '').trim() || `Column ${i + 1}`);
      dataRows = nonEmptyRows.slice(1);
      dataRowStyles = nonEmptyIndices.slice(1).map(idx => rowStylesList[idx] || {});
    } else {
      headers = Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`);
      dataRows = nonEmptyRows;
      dataRowStyles = nonEmptyIndices.map(idx => rowStylesList[idx] || {});
    }

    // Check if table contains at least some content
    if (dataRows.length === 0 && headers.length === 0) return;

    extractedTables.push({
      id: `table-${tableIndex + 1}`,
      index: tableIndex + 1,
      name: tableName,
      headers,
      rows: dataRows,
      rowStyles: dataRowStyles,
      rowCount: dataRows.length,
      colCount: maxCols,
      rawHtmlSnippet: $table.clone().empty().prop('outerHTML') || ''
    });
  });

  // 2. Also check for ARIA role="table" or role="grid" if no standard tables or additional divs
  $('[role="table"], [role="grid"]').each((ariaIndex, ariaElem) => {
    const $grid = $(ariaElem);
    // Avoid double-counting if it's already a <table>
    if ($grid.is('table')) return;

    const tableName = $grid.attr('aria-label') || `ARIA Grid ${ariaIndex + 1}`;
    const rowList: string[][] = [];

    $grid.find('[role="row"]').each((_, rowElem) => {
      const $row = $(rowElem);
      const rowData: string[] = [];
      $row.find('[role="cell"], [role="columnheader"], [role="gridcell"]').each((_, cellElem) => {
        rowData.push(cleanCellText($(cellElem).text(), cleanWhitespace));
      });
      if (rowData.length > 0) {
        rowList.push(rowData);
      }
    });

    if (rowList.length >= minRows) {
      const maxCols = Math.max(...rowList.map(r => r.length));
      const headers = rowList[0].map((h, i) => h || `Col ${i + 1}`);
      const dataRows = rowList.slice(1);

      extractedTables.push({
        id: `aria-table-${ariaIndex + 1}`,
        index: extractedTables.length + 1,
        name: tableName,
        headers,
        rows: dataRows,
        rowCount: dataRows.length,
        colCount: maxCols
      });
    }
  });

  let filteredTables = extractedTables;
  const targetKeyword = options.targetHeaderKeyword?.trim().toLowerCase();
  if (targetKeyword) {
    filteredTables = extractedTables.filter(tbl => {
      const matchName = tbl.name.toLowerCase().includes(targetKeyword);
      const matchHeader = tbl.headers.some(h => h.toLowerCase().includes(targetKeyword));
      return matchName || matchHeader;
    });
  }

  return {
    pageTitle,
    tables: filteredTables
  };
}
