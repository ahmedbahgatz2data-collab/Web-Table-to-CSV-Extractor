import { useState } from 'react';
import { Navbar } from './components/Navbar.js';
import { ExtractorInput } from './components/ExtractorInput.js';
import { TableListView } from './components/TableListView.js';
import { TableEditor } from './components/TableEditor.js';
import { AiExtractorView } from './components/AiExtractorView.js';
import { HelpGuideModal } from './components/HelpGuideModal.js';
import { translations } from './utils/i18n.js';
import { ExtractedTable, ExtractionOptions, BatchUrlItem } from './types/table.js';
import { extractTablesFromHtml } from './utils/tableExtractor.js';
import { createMergedCsvByTableTitle, downloadFile, sanitizeFilename } from './utils/csvExporter.js';
import { AlertCircle, FileSpreadsheet, ExternalLink } from 'lucide-react';

export default function App() {
  const [activeNavTab, setActiveNavTab] = useState<'extractor' | 'ai' | 'guide'>('extractor');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [pageTitle, setPageTitle] = useState<string>('Batch Extraction Dashboard');
  const [sourceUrl, setSourceUrl] = useState<string>('Batch Processing');
  const [tables, setTables] = useState<ExtractedTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [batchItems, setBatchItems] = useState<BatchUrlItem[]>([]);

  const t = translations;

  const handleExtract = async ({
    html,
    options,
  }: {
    html?: string;
    options: ExtractionOptions;
  }) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (html) {
        const result = extractTablesFromHtml(html, options);
        if (result.tables.length === 0) {
          throw new Error('No valid tables were found in the provided HTML.');
        }
        const uniqueTables = result.tables.map((t, i) => ({ ...t, id: `single-${i}-${t.id}` }));
        setTables(uniqueTables);
        setPageTitle(result.pageTitle || 'Manual HTML Code');
        setSourceUrl('Direct HTML Snippet');
        setSelectedTableId(uniqueTables[0].id);
        setBatchItems([]); // Reset batch
      }
      setActiveNavTab('extractor');
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAiExtractedSuccess = (newTables: ExtractedTable[], title: string) => {
    const uniqueTables = newTables.map((t, i) => ({ ...t, id: `ai-${i}-${t.id}` }));
    setTables(uniqueTables);
    setPageTitle(title);
    setSourceUrl('AI Semantic Extraction');
    if (uniqueTables.length > 0) {
      setSelectedTableId(uniqueTables[0].id);
    }
    setBatchItems([]); // Reset batch
    setActiveNavTab('extractor');
  };

  const handleUpdateTable = (updatedTable: ExtractedTable) => {
    setTables((prev) =>
      prev.map((t) => (t.id === updatedTable.id ? updatedTable : t))
    );
  };

  const handleBatchPreviewTable = (table: ExtractedTable, title: string, url: string) => {
    // Show only the selected table
    setTables([table]);
    setSelectedTableId(table.id);
    setPageTitle(title);
    setSourceUrl(url);
  };

  const handleBatchFinished = (allTables: ExtractedTable[], items: BatchUrlItem[]) => {
    if (allTables.length > 0) {
      const uniqueTables = allTables.map((t, i) => ({ ...t, id: `batch-${i}-${t.id}` }));
      setTables(uniqueTables);
      setBatchItems(items);
      setSelectedTableId(uniqueTables[0].id);
      setPageTitle('Batch Extraction Results');
      setSourceUrl('Multiple URLs Batch');
    }
  };

  const handleClearResults = () => {
    setTables([]);
    setSelectedTableId('');
    setBatchItems([]);
    setPageTitle('Batch Extraction Dashboard');
    setSourceUrl('Batch Processing');
  };

  const selectedTable = tables.find((t) => t.id === selectedTableId) || tables[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Bar Contract (3 zones) */}
      <Navbar
        activeTab={activeNavTab}
        onSelectTab={setActiveNavTab}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Hero & Intro Statement */}
        <div className="border-b border-slate-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                {t.appTitle}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
                {t.appSubtitle}
              </p>
            </div>

            {/* Quick Helper Actions */}
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>RFC 4180 / Excel UTF-8</span>
              </span>
            </div>
          </div>
        </div>

        {/* View Switcher: AI Parser or Extractor */}
        {activeNavTab === 'ai' ? (
          <AiExtractorView
            onSuccess={handleAiExtractedSuccess}
            onCancel={() => setActiveNavTab('extractor')}
          />
        ) : (
          <ExtractorInput
            onExtract={handleExtract}
            isLoading={isLoading}
            onSwitchToAi={() => setActiveNavTab('ai')}
            onBatchPreviewTable={handleBatchPreviewTable}
            onBatchFinished={handleBatchFinished}
          />
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="font-semibold">{errorMessage}</div>
              <div className="text-red-600">
                Tip: You can copy the HTML page source and paste it directly into "Paste Raw HTML" to bypass web protections.
              </div>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-800 font-mono text-xs px-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Extracted Tables Section */}
        {tables.length > 0 && (
          <div className="space-y-5">
            {/* Source Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>{t.source}:</span>
                <span className="font-medium text-slate-800 truncate max-w-md">
                  {pageTitle}
                </span>
                {sourceUrl.startsWith('http') && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="text-slate-400 font-mono text-[11px] flex items-center gap-3">
                {new Date().toLocaleTimeString('en-US')}
                <button 
                  onClick={handleClearResults}
                  className="text-xs text-red-600 hover:text-red-800 font-medium cursor-pointer"
                >
                  Clear Results
                </button>
              </div>
            </div>

            {/* If more than 1 table found: show table selection strip */}
            {tables.length > 1 && (
              <TableListView
                tables={tables}
                selectedTableId={selectedTableId}
                onSelectTable={setSelectedTableId}
              />
            )}

            {/* Active Table Viewer & Interactive Data Grid */}
            {selectedTable && (
              <TableEditor
                key={selectedTable.id}
                table={selectedTable}
                onUpdateTable={handleUpdateTable}
                onDownloadAllByTitle={
                  tables.length > 1
                    ? (title, includeBom) => {
                        const mergedContent = createMergedCsvByTableTitle(
                          batchItems.filter(item => item.status === 'success'),
                          title,
                          { delimiter: ',', includeBom: includeBom }
                        );
                        downloadFile(
                          mergedContent,
                          `merged_batch_${sanitizeFilename(title)}.csv`,
                          'text/csv;charset=utf-8;'
                        );
                      }
                    : undefined
                }
              />
            )}
          </div>
        )}
      </main>

      {/* Guide Modal */}
      <HelpGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
