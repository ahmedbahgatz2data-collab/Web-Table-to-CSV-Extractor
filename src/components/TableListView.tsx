import React, { useState } from 'react';
import { ExtractedTable } from '../types/table.js';
import { translations } from '../utils/i18n.js';
import { tableToCsv, sanitizeFilename } from '../utils/csvExporter.js';
import JSZip from 'jszip';
import { Archive, Table, Check, Loader2 } from 'lucide-react';

interface TableListViewProps {
  tables: ExtractedTable[];
  selectedTableId: string;
  onSelectTable: (id: string) => void;
}

export const TableListView: React.FC<TableListViewProps> = ({
  tables,
  selectedTableId,
  onSelectTable,
}) => {
  const t = translations;
  const [isZipping, setIsZipping] = useState(false);
  const [zipDownloaded, setZipDownloaded] = useState(false);

  const handleDownloadAllZip = async () => {
    if (tables.length === 0 || isZipping) return;
    setIsZipping(true);

    try {
      const zip = new JSZip();
      tables.forEach((table, index) => {
        const csvContent = tableToCsv(table, { delimiter: ',', includeBom: true });
        const safeName = sanitizeFilename(table.name || `table_${index + 1}`);
        zip.file(`${index + 1}_${safeName}.csv`, csvContent);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `extracted_tables_${new Date().toISOString().slice(0, 10)}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setZipDownloaded(true);
      setTimeout(() => setZipDownloaded(false), 3000);
    } catch (err) {
      console.error('Failed to create zip:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Table className="w-4 h-4 text-blue-600" />
            <span>
              {t.tablesFoundCount.replace('{count}', String(tables.length))}
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Select a table to preview/edit, or download all tables simultaneously
          </p>
        </div>

        {tables.length > 1 && (
          <button
            onClick={handleDownloadAllZip}
            disabled={isZipping}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            {isZipping ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Zipping tables...</span>
              </>
            ) : zipDownloaded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Downloaded!</span>
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5" />
                <span>{t.downloadAllZip}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Grid of Tables */}
      <div className="max-h-[50vh] overflow-y-auto custom-scrollbar pr-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {tables.map((tbl) => {
          const isSelected = tbl.id === selectedTableId;
          return (
            <div
              key={tbl.id}
              onClick={() => onSelectTable(tbl.id)}
              className={`p-3 rounded-lg border text-start cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-xs text-slate-800 line-clamp-1" title={tbl.name}>
                  {tbl.name}
                </span>
                <span className="font-mono text-[10px] text-slate-400 shrink-0">
                  #{tbl.index}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-2 font-mono tabular-nums">
                <span>{tbl.rowCount} rows</span>
                <span aria-hidden="true">·</span>
                <span>{tbl.colCount} cols</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
