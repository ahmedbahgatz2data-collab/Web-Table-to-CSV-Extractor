import React, { useState, useMemo } from 'react';
import { ExtractedTable, CsvExportOptions } from '../types/table.js';
import { translations } from '../utils/i18n.js';
import {
  tableToCsv,
  tableToTsv,
  tableToJson,
  tableToMarkdown,
  downloadFile,
  sanitizeFilename,
} from '../utils/csvExporter.js';
import { exportTableToXlsx } from '../utils/excelExporter.js';
import {
  Download,
  Copy,
  Check,
  Search,
  Plus,
  Trash2,
  ArrowUpDown,
  FileSpreadsheet,
  FileCode,
  FileText,
  RotateCcw,
  Sparkles,
  Archive,
  Tag,
} from 'lucide-react';

interface TableEditorProps {
  table: ExtractedTable;
  onUpdateTable: (updatedTable: ExtractedTable) => void;
  onDownloadAllByTitle?: (title: string, format: 'xlsx' | 'csv') => void;
}

export const TableEditor: React.FC<TableEditorProps> = ({
  table,
  onUpdateTable,
  onDownloadAllByTitle,
}) => {
  const t = translations;

  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    colIndex: number;
  } | null>(null);
  const [editingHeaderIndex, setEditingHeaderIndex] = useState<number | null>(
    null
  );
  const [cellEditValue, setCellEditValue] = useState('');
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    colIndex: number;
    direction: 'asc' | 'desc';
  } | null>(null);

  // Filter rows based on search query
  const filteredRows = useMemo(() => {
    let rows = table.rows.map((row, originalIndex) => ({
      data: row,
      originalIndex,
    }));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((r) =>
        r.data.some((cell) => cell.toLowerCase().includes(q))
      );
    }

    if (sortConfig !== null) {
      rows.sort((a, b) => {
        const valA = a.data[sortConfig.colIndex] || '';
        const valB = b.data[sortConfig.colIndex] || '';
        // Check if numeric
        const numA = parseFloat(valA.replace(/[^0-9.-]/g, ''));
        const numB = parseFloat(valB.replace(/[^0-9.-]/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
        }
        return sortConfig.direction === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      });
    }

    return rows;
  }, [table.rows, searchQuery, sortConfig]);

  // Handle Sort
  const handleSort = (colIndex: number) => {
    if (sortConfig && sortConfig.colIndex === colIndex) {
      if (sortConfig.direction === 'asc') {
        setSortConfig({ colIndex, direction: 'desc' });
      } else {
        setSortConfig(null);
      }
    } else {
      setSortConfig({ colIndex, direction: 'asc' });
    }
  };

  // Export as CSV
  const handleDownloadCsv = (delimiter: ',' | ';' = ',') => {
    const options: Partial<CsvExportOptions> = {
      delimiter,
      includeBom: true, // UTF-8 BOM for Arabic in Excel
      quoteStrings: false,
    };
    const csvContent = tableToCsv(table, options);
    const filename = `${sanitizeFilename(table.name || 'table')}.csv`;
    downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
  };

  // Export as TSV (Tab separated)
  const handleDownloadTsv = () => {
    const tsvContent = tableToTsv(table);
    const filename = `${sanitizeFilename(table.name || 'table')}.tsv`;
    downloadFile(tsvContent, filename, 'text/tab-separated-values;charset=utf-8;');
  };

  // Copy to Clipboard as TSV
  const handleCopyTsv = async () => {
    const tsvContent = tableToTsv(table);
    try {
      await navigator.clipboard.writeText(tsvContent);
      setCopiedStatus('tsv');
      setTimeout(() => setCopiedStatus(null), 2500);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = tsvContent;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedStatus('tsv');
      setTimeout(() => setCopiedStatus(null), 2500);
    }
  };

  // Export as JSON
  const handleDownloadJson = () => {
    const jsonContent = tableToJson(table);
    const filename = `${sanitizeFilename(table.name || 'table')}.json`;
    downloadFile(jsonContent, filename, 'application/json;charset=utf-8;');
  };

  // Export as Markdown
  const handleDownloadMarkdown = () => {
    const mdContent = tableToMarkdown(table);
    const filename = `${sanitizeFilename(table.name || 'table')}.md`;
    downloadFile(mdContent, filename, 'text/markdown;charset=utf-8;');
  };

  // Edit cell start
  const handleStartCellEdit = (
    rowIndex: number,
    colIndex: number,
    value: string
  ) => {
    setEditingCell({ rowIndex, colIndex });
    setCellEditValue(value);
  };

  // Save cell edit
  const handleSaveCellEdit = () => {
    if (!editingCell) return;
    const newRows = [...table.rows.map((r) => [...r])];
    newRows[editingCell.rowIndex][editingCell.colIndex] = cellEditValue;
    onUpdateTable({
      ...table,
      rows: newRows,
    });
    setEditingCell(null);
  };

  // Save header edit
  const handleSaveHeaderEdit = () => {
    if (editingHeaderIndex === null) return;
    const newHeaders = [...table.headers];
    newHeaders[editingHeaderIndex] = cellEditValue;
    onUpdateTable({
      ...table,
      headers: newHeaders,
    });
    setEditingHeaderIndex(null);
  };

  // Add row
  const handleAddRow = () => {
    const emptyRow = new Array(table.headers.length).fill('');
    const newRows = [...table.rows, emptyRow];
    onUpdateTable({
      ...table,
      rows: newRows,
      rowCount: newRows.length,
    });
  };

  // Add column
  const handleAddColumn = () => {
    const newHeaders = [...table.headers, `Column ${table.headers.length + 1}`];
    const newRows = table.rows.map((row) => [...row, '']);
    onUpdateTable({
      ...table,
      headers: newHeaders,
      rows: newRows,
      colCount: newHeaders.length,
    });
  };

  // Delete row
  const handleDeleteRow = (rowIndex: number) => {
    const newRows = table.rows.filter((_, idx) => idx !== rowIndex);
    onUpdateTable({
      ...table,
      rows: newRows,
      rowCount: newRows.length,
    });
  };

  // Delete column
  const handleDeleteColumn = (colIndex: number) => {
    if (table.headers.length <= 1) return;
    const newHeaders = table.headers.filter((_, idx) => idx !== colIndex);
    const newRows = table.rows.map((row) =>
      row.filter((_, idx) => idx !== colIndex)
    );
    onUpdateTable({
      ...table,
      headers: newHeaders,
      rows: newRows,
      colCount: newHeaders.length,
    });
  };

  // Transpose table (flip rows and cols)
  const handleTranspose = () => {
    const allRows = [table.headers, ...table.rows];
    const newColCount = allRows.length;
    const newRowCount = table.headers.length;

    const transposedMatrix: string[][] = [];
    for (let c = 0; c < newRowCount; c++) {
      transposedMatrix[c] = [];
      for (let r = 0; r < newColCount; r++) {
        transposedMatrix[c][r] = allRows[r]?.[c] ?? '';
      }
    }

    if (transposedMatrix.length === 0) return;

    const newHeaders = transposedMatrix[0];
    const newRows = transposedMatrix.slice(1);

    onUpdateTable({
      ...table,
      headers: newHeaders,
      rows: newRows,
      rowCount: newRows.length,
      colCount: newHeaders.length,
    });
  };

  // Clean empty rows
  const handleCleanEmptyRows = () => {
    const newRows = table.rows.filter((row) =>
      row.some((cell) => cell.trim().length > 0)
    );
    onUpdateTable({
      ...table,
      rows: newRows,
      rowCount: newRows.length,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
      {/* Table Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={table.name}
              onChange={(e) =>
                onUpdateTable({ ...table, name: e.target.value })
              }
              className="text-base sm:text-lg font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none pb-0.5 transition-colors"
            />
          </div>
          {/* Metadata line without pill enclosures */}
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span>
              {t.rowsCount}:{' '}
              <strong className="font-mono tabular-nums text-slate-700">
                {table.rows.length}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t.colsCount}:{' '}
              <strong className="font-mono tabular-nums text-slate-700">
                {table.headers.length}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-600 font-medium">
              UTF-8 BOM (Excel جاهز)
            </span>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onDownloadAllByTitle && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => onDownloadAllByTitle(table.name, 'xlsx')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs sm:text-sm rounded-lg shadow-xs transition-colors cursor-pointer"
                title="Download all instances across all URLs as Excel (.xlsx) with colors"
              >
                <Archive className="w-4 h-4" />
                <span>All '{table.name}' (Excel)</span>
              </button>
              <button
                onClick={() => onDownloadAllByTitle(table.name, 'csv')}
                className="flex items-center gap-1 px-3 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 font-medium text-xs sm:text-sm rounded-lg transition-colors cursor-pointer"
                title="Download all instances across all URLs as CSV"
              >
                <span>All '{table.name}' (CSV)</span>
              </button>
            </div>
          )}


          {/* Download Excel (.xlsx) with Preserved Colors */}
          <button
            onClick={() => exportTableToXlsx(table)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
            title="Download formatted Excel workbook with colored rows and custom styling preserved"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download Excel (.xlsx)</span>
          </button>

          {/* Download CSV with BOM (Direct) */}
          <button
            onClick={() => handleDownloadCsv(',')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{t.downloadCsv}</span>
          </button>

          {/* Copy for Sheets / Excel */}
          <button
            onClick={handleCopyTsv}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs sm:text-sm rounded-lg transition-colors shrink-0 cursor-pointer"
            title="نسخ الجدول ولصقه مباشرة في Excel أو Google Sheets"
          >
            {copiedStatus === 'tsv' ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">{t.copiedTsv}</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" />
                <span>{t.copyTsv}</span>
              </>
            )}
          </button>

          {/* More Formats Dropdown / Buttons */}
          <button
            onClick={handleDownloadJson}
            className="flex items-center gap-1.5 px-2.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs rounded-lg transition-colors"
            title={t.exportJson}
          >
            <FileCode className="w-3.5 h-3.5 text-amber-600" />
            <span>JSON</span>
          </button>

          <button
            onClick={handleDownloadMarkdown}
            className="flex items-center gap-1.5 px-2.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs rounded-lg transition-colors"
            title={t.exportMarkdown}
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Markdown</span>
          </button>

          <button
            onClick={() => handleDownloadCsv(';')}
            className="flex items-center gap-1 px-2.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs rounded-lg transition-colors font-mono"
            title="CSV مع فاصلة منقوطة (Semicolon ;)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />
            <span>CSV (;)</span>
          </button>
        </div>
      </div>

      {/* Table Toolbar (Search & Operations) */}
      <div className="p-3 sm:px-5 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchInTable}
            className="w-full h-8 ps-8 pe-3 rounded-md bg-white border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs text-slate-800 outline-none"
          />
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleAddRow}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-md transition-colors"
          >
            <Plus className="w-3 h-3 text-blue-600" />
            <span>{t.addRow}</span>
          </button>

          <button
            onClick={handleAddColumn}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-md transition-colors"
          >
            <Plus className="w-3 h-3 text-emerald-600" />
            <span>{t.addCol}</span>
          </button>

          <button
            onClick={handleTranspose}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-md transition-colors"
            title="تبديل الأعمدة لتصبح صفوفاً والعكس"
          >
            <RotateCcw className="w-3 h-3 text-purple-600" />
            <span>{t.transposeTable}</span>
          </button>

          <button
            onClick={handleCleanEmptyRows}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-md transition-colors"
          >
            <Sparkles className="w-3 h-3 text-amber-600" />
            <span>{t.cleanEmptyRows}</span>
          </button>
        </div>
      </div>

      {/* High-Density Data Grid Viewport */}
      <div className="overflow-x-auto max-h-[580px] custom-scrollbar border-b border-slate-100">
        <table className="w-full border-collapse text-xs text-start">
          <thead className="sticky top-0 bg-slate-100 text-slate-700 font-semibold shadow-xs z-10">
            <tr>
              {/* Row index indicator header */}
              <th className="w-12 px-2.5 py-2.5 border-b border-r border-slate-300 bg-slate-200/70 text-center text-slate-500 font-mono text-[11px] select-none">
                #
              </th>

              {table.headers.map((header, colIndex) => (
                <th
                  key={colIndex}
                  className="px-3 py-2.5 border-b border-r border-slate-300 text-start group hover:bg-slate-200 transition-colors whitespace-nowrap min-w-[120px]"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    {editingHeaderIndex === colIndex ? (
                      <input
                        type="text"
                        autoFocus
                        value={cellEditValue}
                        onChange={(e) => setCellEditValue(e.target.value)}
                        onBlur={handleSaveHeaderEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveHeaderEdit();
                          if (e.key === 'Escape') setEditingHeaderIndex(null);
                        }}
                        className="w-full px-1.5 py-0.5 border border-blue-500 rounded bg-white font-medium outline-none text-slate-900"
                      />
                    ) : (
                      <div
                        onClick={() => {
                          setEditingHeaderIndex(colIndex);
                          setCellEditValue(header);
                        }}
                        className="cursor-pointer truncate max-w-[220px] font-semibold text-slate-800"
                        title="انقر لتعديل عنوان العمود"
                      >
                        {header || `Column ${colIndex + 1}`}
                      </div>
                    )}

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleSort(colIndex)}
                        className="p-1 hover:bg-slate-300 rounded text-slate-500 hover:text-slate-800"
                        title="ترتيب تصاعدي / تنازلي"
                      >
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                      {table.headers.length > 1 && (
                        <button
                          onClick={() => handleDeleteColumn(colIndex)}
                          className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
                          title={t.deleteCol}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </th>
              ))}

              <th className="w-10 px-2 py-2.5 border-b border-slate-300 text-center"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 bg-white">
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.headers.length + 2}
                  className="py-12 text-center text-slate-400 italic"
                >
                  {searchQuery
                    ? 'لا توجد نتائج مطابقة لبحثك'
                    : 'الجدول لا يحتوي على أي صفوف'}
                </td>
              </tr>
            ) : (
              filteredRows.map(({ data: row, originalIndex }, displayRowIndex) => {
                const rowStyle = table.rowStyles?.[originalIndex];
                const tag = rowStyle?.tag || rowStyle?.className || '';
                const hexBg = rowStyle?.hexBg;
                const hexColor = rowStyle?.hexColor;

                const isNotRecommended = tag.toLowerCase().includes('notrecommended');
                const isWarning = isNotRecommended || tag.toLowerCase().includes('warn') || tag.toLowerCase().includes('danger') || tag.toLowerCase().includes('obsolete');

                const customRowStyle: React.CSSProperties = hexBg ? {
                  backgroundColor: `#${hexBg}2A`,
                  borderLeft: `4px solid #${hexBg}`,
                } : {};

                return (
                  <tr
                    key={originalIndex}
                    style={customRowStyle}
                    className={`transition-colors group ${
                      !hexBg ? (
                        isNotRecommended
                          ? 'bg-amber-50/80 hover:bg-amber-100/70 border-l-4 border-l-amber-500'
                          : isWarning
                          ? 'bg-red-50/60 hover:bg-red-100/60 border-l-4 border-l-red-500'
                          : 'hover:bg-blue-50/30'
                      ) : 'hover:brightness-95'
                    }`}
                  >
                    {/* Row Number & Status Tag */}
                    <td className="px-2 py-2 border-r border-slate-200 text-center font-mono tabular-nums text-[11px] select-none bg-slate-50/60 text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span>{displayRowIndex + 1}</span>
                        {hexBg && (
                          <span
                            style={{
                              backgroundColor: `#${hexBg}`,
                              color: hexColor ? `#${hexColor}` : '#1e293b',
                            }}
                            className="text-[9px] px-1 py-0.5 rounded font-semibold whitespace-nowrap leading-none shadow-2xs border border-black/10"
                            title={`Detected Color: #${hexBg}${tag ? ` (${tag})` : ''}`}
                          >
                            {tag || 'Colored'}
                          </span>
                        )}
                        {!hexBg && tag && (
                          <span className="text-[9px] px-1 py-0.5 bg-slate-200 text-slate-800 rounded font-medium whitespace-nowrap leading-none">
                            {tag}
                          </span>
                        )}
                      </div>
                    </td>

                  {/* Cell Data */}
                  {table.headers.map((_, colIndex) => {
                    const cellVal = row[colIndex] ?? '';
                    const isEditing =
                      editingCell?.rowIndex === originalIndex &&
                      editingCell?.colIndex === colIndex;

                    // Numeric detection for right-alignment and tabular font
                    const isNumeric =
                      !isNaN(Number(cellVal.replace(/[^0-9.-]/g, ''))) &&
                      cellVal.trim().length > 0 &&
                      !cellVal.includes(' ');

                    return (
                      <td
                        key={colIndex}
                        onClick={() =>
                          handleStartCellEdit(originalIndex, colIndex, cellVal)
                        }
                        className={`px-3 py-2 border-r border-slate-200 cursor-pointer min-w-[110px] max-w-[280px] truncate ${
                          isNumeric ? 'text-end font-mono tabular-nums' : 'text-start'
                        }`}
                        title={cellVal}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            autoFocus
                            value={cellEditValue}
                            onChange={(e) => setCellEditValue(e.target.value)}
                            onBlur={handleSaveCellEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveCellEdit();
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-full px-1.5 py-0.5 border border-blue-500 rounded bg-white text-slate-900 outline-none text-xs"
                          />
                        ) : (
                          <span
                            className={
                              cellVal ? 'text-slate-800' : 'text-slate-300 italic'
                            }
                          >
                            {cellVal || '-'}
                          </span>
                        )}
                      </td>
                    );
                  })}

                  {/* Row Actions */}
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => handleDeleteRow(originalIndex)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-opacity"
                      title={t.deleteRow}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>

      {/* Excel Arabic Note Footer */}
      <div className="p-3 bg-slate-50/80 rounded-b-xl flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>{t.excelArabicNote}</span>
        </div>
        <div className="font-mono text-slate-400 text-[11px]">
          {filteredRows.length} / {table.rows.length} rows visible
        </div>
      </div>
    </div>
  );
};
