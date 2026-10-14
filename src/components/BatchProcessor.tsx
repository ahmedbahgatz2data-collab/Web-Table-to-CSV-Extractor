import React, { useState, useRef } from 'react';
import { translations } from '../utils/i18n.js';
import { BatchUrlItem, ExtractionOptions, ExtractedTable } from '../types/table.js';
import { createMergedCsv, tableToCsv, sanitizeFilename, downloadFile } from '../utils/csvExporter.js';
import JSZip from 'jszip';
import {
  Layers,
  Play,
  Square,
  Download,
  Archive,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Sparkles,
  ExternalLink,
  Eye,
  RefreshCw,
  Trash2,
  FileText,
} from 'lucide-react';

interface BatchProcessorProps {
  options: ExtractionOptions;
  onSelectTableForPreview: (table: ExtractedTable, pageTitle: string, sourceUrl: string) => void;
  onBatchFinished?: (allTables: ExtractedTable[], items: BatchUrlItem[]) => void;
}

const SAMPLE_BATCH_URLS = [
  'https://en.wikipedia.org/wiki/List_of_countries_by_population_(United_Nations)',
  'https://en.wikipedia.org/wiki/List_of_African_countries_by_population',
  'https://en.wikipedia.org/wiki/List_of_European_countries_by_population'
];

export const BatchProcessor: React.FC<BatchProcessorProps> = ({
  options,
  onSelectTableForPreview,
  onBatchFinished,
}) => {
  const t = translations;
  const [urlsInput, setUrlsInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [items, setItems] = useState<BatchUrlItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const cancelRequestedRef = useRef(false);

  // Parse entered URLs and remove duplicates
  const rawUrls = urlsInput
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));

  const parsedUrls = Array.from(new Set(rawUrls));
  const duplicateCount = rawUrls.length - parsedUrls.length;

  const handleLoadSampleUrls = () => {
    setUrlsInput(SAMPLE_BATCH_URLS.join('\n'));
  };

  const processItemsList = async (targetItems: BatchUrlItem[]) => {
    cancelRequestedRef.current = false;
    setIsRunning(true);

    const successfulItems: BatchUrlItem[] = targetItems.filter(i => i.status === 'success');
    const allCollectedTables: ExtractedTable[] = [];
    targetItems.forEach(it => {
      if (it.tables && it.tables.length > 0) allCollectedTables.push(...it.tables);
    });

    for (let i = 0; i < targetItems.length; i++) {
      if (cancelRequestedRef.current) break;

      const item = targetItems[i];
      // Only process pending or error items
      if (item.status === 'success') continue;

      const globalIndex = items.findIndex(it => it.id === item.id);
      setCurrentIndex(globalIndex >= 0 ? globalIndex : i);

      setItems(prev =>
        prev.map(it => (it.id === item.id ? { ...it, status: 'processing' } : it))
      );

      let formattedUrl = item.url;
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = 'https://' + formattedUrl;
      }

      try {
        const response = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: formattedUrl,
            options,
          }),
        });

        const data = await response.json();

        if (cancelRequestedRef.current) break;

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to extract tables');
        }

        const extractedTables: ExtractedTable[] = data.tables || [];

        const updatedItem: BatchUrlItem = {
          ...item,
          status: 'success',
          pageTitle: data.pageTitle || 'Web Page',
          tables: extractedTables,
          tableCount: extractedTables.length,
          error: undefined,
        };

        successfulItems.push(updatedItem);
        allCollectedTables.push(...extractedTables);

        setItems(prev =>
          prev.map(it => (it.id === item.id ? updatedItem : it))
        );
      } catch (err: unknown) {
        if (cancelRequestedRef.current) break;

        const error = err as Error;
        const failedItem: BatchUrlItem = {
          ...item,
          status: 'error',
          error: error.message || 'Network / parsing error',
          tables: [],
          tableCount: 0,
        };

        setItems(prev =>
          prev.map(it => (it.id === item.id ? failedItem : it))
        );
      }
    }

    setIsRunning(false);
    setCurrentIndex(null);

    if (onBatchFinished && allCollectedTables.length > 0) {
      onBatchFinished(allCollectedTables, items);
    }
  };

  const handleStartBatch = async () => {
    if (parsedUrls.length === 0 || isRunning) return;

    // Initialize items
    const initialItems: BatchUrlItem[] = parsedUrls.map((url, idx) => ({
      id: `batch-${idx + 1}-${Date.now()}`,
      url,
      status: 'pending',
      tables: [],
    }));

    setItems(initialItems);
    await processItemsList(initialItems);
  };

  const handleRetryFailed = async () => {
    const failedItems = items.filter(it => it.status === 'error');
    if (failedItems.length === 0 || isRunning) return;

    // Reset failed items to pending
    const resetItems = items.map(it =>
      it.status === 'error' ? { ...it, status: 'pending' as const, error: undefined } : it
    );
    setItems(resetItems);
    await processItemsList(resetItems);
  };

  const handleClearResults = () => {
    if (isRunning) return;
    setItems([]);
  };

  const handleCancelBatch = () => {
    cancelRequestedRef.current = true;
    setIsRunning(false);
    setCurrentIndex(null);
  };

  // Stats calculation
  const totalCompleted = items.filter(
    item => item.status === 'success' || item.status === 'error'
  ).length;
  const totalSuccess = items.filter(item => item.status === 'success').length;
  const totalFailed = items.filter(item => item.status === 'error').length;
  const totalTablesCount = items.reduce(
    (acc, item) => acc + (item.tables?.length || 0),
    0
  );
  const progressPercent =
    items.length > 0 ? Math.round((totalCompleted / items.length) * 100) : 0;

  // Download All as ZIP
  const handleDownloadZip = async () => {
    const successItems = items.filter(
      item => item.status === 'success' && (item.tables?.length || 0) > 0
    );
    if (successItems.length === 0 || isZipping) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();

      successItems.forEach((item, urlIdx) => {
        const urlDomain = new URL(
          item.url.startsWith('http') ? item.url : `https://${item.url}`
        ).hostname.replace('www.', '');
        const safeDomain = sanitizeFilename(urlDomain, 'domain');

        item.tables?.forEach((table, tblIdx) => {
          const csv = tableToCsv(table, { delimiter: ',', includeBom: true });
          const safeName = sanitizeFilename(table.name || `table_${tblIdx + 1}`);
          const filename = `${urlIdx + 1}_${safeDomain}_table${tblIdx + 1}_${safeName}.csv`;
          zip.file(filename, csv);
        });
      });

      const mergedCsv = createMergedCsv(
        successItems.map(item => ({
          url: item.url,
          pageTitle: item.pageTitle,
          tables: item.tables || [],
        })),
        { delimiter: ',', includeBom: true }
      );
      zip.file('_merged_all_tables.csv', mergedCsv);

      const summaryText = generateLogReportContent();
      zip.file('batch_summary.txt', summaryText);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `batch_tables_${new Date().toISOString().slice(0, 10)}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error('ZIP generation error:', e);
    } finally {
      setIsZipping(false);
    }
  };

  // Generate detailed log report as clean text
  const generateLogReportContent = (): string => {
    const failedItems = items.filter(item => item.status === 'error');
    const successItems = items.filter(item => item.status === 'success');
    const pendingItems = items.filter(item => item.status === 'pending' || item.status === 'processing');

    const timestamp = new Date().toISOString();
    const formattedDate = new Date().toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
    });

    let report = `================================================================================
BATCH WEB TABLE EXTRACTION - LOG & AUDIT REPORT
================================================================================
Generated:         ${formattedDate} (${timestamp})
Total URLs:        ${items.length}
Successful URLs:   ${successItems.length}
Failed URLs:       ${failedItems.length}
Pending / Other:   ${pendingItems.length}
Total Tables Found: ${totalTablesCount}
================================================================================

`;

    // 1. FAILED URLS BREAKDOWN
    report += `--------------------------------------------------------------------------------
1. FAILED URLS & ENCOUNTERED ERRORS (${failedItems.length})
--------------------------------------------------------------------------------\n`;

    if (failedItems.length === 0) {
      report += `No failures recorded. All URLs processed successfully!\n\n`;
    } else {
      failedItems.forEach((item, idx) => {
        report += `[FAILED #${idx + 1}]\n`;
        report += `  Target URL:     ${item.url}\n`;
        report += `  Status:         ERROR\n`;
        report += `  Specific Error: ${item.error || 'Failed to fetch or parse web page.'}\n`;
        report += `  Troubleshoot:   - Check if the site requires login/authentication or blocks scrapers.\n`;
        report += `                  - Try copying the page HTML and pasting into "Paste Raw HTML" mode.\n`;
        report += `                  - Ensure the URL is accessible from your network.\n\n`;
      });
    }

    // 2. SUCCESSFUL URLS BREAKDOWN
    report += `--------------------------------------------------------------------------------
2. SUCCESSFUL URLS & EXTRACTED TABLES (${successItems.length})
--------------------------------------------------------------------------------\n`;

    if (successItems.length === 0) {
      report += `No successful extractions in this batch.\n\n`;
    } else {
      successItems.forEach((item, idx) => {
        report += `[SUCCESS #${idx + 1}]\n`;
        report += `  Target URL:     ${item.url}\n`;
        report += `  Page Title:     ${item.pageTitle || 'Untitled Page'}\n`;
        report += `  Tables Found:   ${item.tables?.length || 0}\n`;
        if (item.tables && item.tables.length > 0) {
          item.tables.forEach((t, tIdx) => {
            report += `    Table ${tIdx + 1}: "${t.name}" -> ${t.rowCount} rows, ${t.colCount} columns\n`;
          });
        }
        report += `\n`;
      });
    }

    // 3. MASTER LOG MANIFEST
    report += `--------------------------------------------------------------------------------
3. FULL BATCH RUN MANIFEST
--------------------------------------------------------------------------------\n`;
    items.forEach((item, idx) => {
      const num = String(idx + 1).padStart(3, ' ');
      const status = item.status.toUpperCase().padEnd(10, ' ');
      const details = item.status === 'error'
        ? `[ERROR] ${item.error || 'Failed'}`
        : item.status === 'success'
        ? `[OK] ${item.tables?.length || 0} tables extracted`
        : `[${item.status}]`;
      report += `${num}. [${status}] ${item.url} -> ${details}\n`;
    });

    report += `\n================================================================================
END OF LOG REPORT
================================================================================\n`;

    return report;
  };

  // Export Batch Log Report as a .txt file
  const handleExportLogReport = () => {
    if (items.length === 0) return;
    const reportText = generateLogReportContent();
    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
    const filename = `batch_log_report_${dateStr}_${timeStr}.txt`;
    downloadFile(reportText, filename, 'text/plain;charset=utf-8;');
  };

  // Download Merged CSV
  const handleDownloadMergedCsv = () => {
    const successItems = items.filter(
      item => item.status === 'success' && (item.tables?.length || 0) > 0
    );
    if (successItems.length === 0) return;

    const mergedContent = createMergedCsv(
      successItems.map(item => ({
        url: item.url,
        pageTitle: item.pageTitle,
        tables: item.tables || [],
      })),
      { delimiter: ',', includeBom: true }
    );

    const filename = `merged_batch_tables_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadFile(mergedContent, filename, 'text/csv;charset=utf-8;');
  };

  return (
    <div className="space-y-4">
      {/* URL Input Form */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>URL List (one URL per line, duplicates auto-removed):</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadSampleUrls}
              disabled={isRunning}
              className="text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>{t.batchPresetBtn}</span>
            </button>
            {urlsInput && (
              <button
                type="button"
                onClick={() => setUrlsInput('')}
                disabled={isRunning}
                className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <textarea
          dir="ltr"
          rows={5}
          value={urlsInput}
          onChange={e => setUrlsInput(e.target.value)}
          disabled={isRunning}
          placeholder={t.batchPlaceholder}
          className="w-full p-3.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-900 placeholder-slate-400 text-xs font-mono transition-all outline-none resize-y"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 mt-2 text-xs">
          <div className="text-slate-500 font-mono text-[11px] flex items-center gap-2">
            <span>{t.batchUrlsDetected.replace('{count}', String(parsedUrls.length))}</span>
            {duplicateCount > 0 && (
              <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                ({duplicateCount} duplicate{duplicateCount > 1 ? 's' : ''} removed)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isRunning ? (
              <button
                type="button"
                onClick={handleCancelBatch}
                className="h-10 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                <span>{t.batchCancel}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartBatch}
                disabled={parsedUrls.length === 0}
                className="h-10 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{t.batchExtractBtn}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Progress Bar */}
      {isRunning && (
        <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-blue-900 font-medium">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>
                {t.batchProgress
                  .replace('{current}', String((currentIndex ?? 0) + 1))
                  .replace('{total}', String(items.length))}
              </span>
            </span>
            <span className="font-mono tabular-nums">{progressPercent}%</span>
          </div>
          <div className="w-full bg-blue-200/60 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Batch Results & Action Center */}
      {items.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
          {/* Header Summary Banner */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>{t.batchResultsTitle}</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
                {t.batchSummary
                  .replace('{tables}', String(totalTablesCount))
                  .replace('{urls}', String(totalSuccess))}
                {totalFailed > 0 && ` (${totalFailed} failed)`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {totalFailed > 0 && !isRunning && (
                <button
                  type="button"
                  onClick={handleRetryFailed}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t.retryFailed} ({totalFailed})</span>
                </button>
              )}

              {totalTablesCount > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleDownloadZip}
                    disabled={isZipping || isRunning}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-medium text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
                  >
                    {isZipping ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Archive className="w-3.5 h-3.5" />
                    )}
                    <span>{t.batchDownloadZip}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadMergedCsv}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.batchDownloadMergedCsv}</span>
                  </button>
                </>
              )}

              {!isRunning && items.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportLogReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg border border-slate-300 transition-colors shadow-xs cursor-pointer"
                  title="Export detailed log report with failures and errors as a .txt file"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  <span>{t.batchExportLog}</span>
                </button>
              )}

              {!isRunning && (
                <button
                  type="button"
                  onClick={handleClearResults}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs rounded-lg transition-colors cursor-pointer"
                  title="Clear results list"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.clearResults}</span>
                </button>
              )}
            </div>
          </div>

          {/* Queue List of Items */}
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto custom-scrollbar">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={`p-3 transition-colors flex flex-wrap items-center justify-between gap-3 text-xs ${
                  item.status === 'error' ? 'bg-red-50/70 border-l-4 border-l-red-500' : 'hover:bg-slate-50/70'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="font-mono text-[10px] text-slate-400 w-5 shrink-0">
                    #{idx + 1}
                  </span>

                  {item.status === 'processing' ? (
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                  ) : item.status === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : item.status === 'error' ? (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-800 truncate" title={item.url}>
                        {item.url}
                      </span>
                      <a
                        href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-slate-400 hover:text-blue-600 shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    {item.pageTitle && (
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {item.pageTitle}
                      </div>
                    )}
                    {item.error && (
                      <div className="text-[11px] text-red-600 truncate mt-0.5">
                        {item.error}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status & Preview Affordance */}
                <div className="flex items-center gap-2 shrink-0">
                  {item.status === 'success' && (
                    <span className="font-mono text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      {item.tableCount} tables
                    </span>
                  )}

                  {item.status === 'error' && (
                    <span className="font-mono text-[11px] text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                      Failed
                    </span>
                  )}

                  {item.status === 'success' && item.tables && item.tables.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        onSelectTableForPreview(
                          item.tables![0],
                          item.pageTitle || 'Web Page',
                          item.url
                        )
                      }
                      className="flex items-center gap-1 px-2 py-1 text-[11px] text-blue-600 hover:bg-blue-50 border border-blue-200 rounded transition-colors cursor-pointer"
                      title="Preview in editor"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Preview</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
