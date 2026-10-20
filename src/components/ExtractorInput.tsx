import React, { useState, useRef } from 'react';
import { translations } from '../utils/i18n.js';
import { ExtractionOptions, ExtractedTable, BatchUrlItem } from '../types/table.js';
import { BatchProcessor } from './BatchProcessor.js';
import {
  Layers,
  Code2,
  UploadCloud,
  SlidersHorizontal,
  Loader2,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Shield,
} from 'lucide-react';

interface ExtractorInputProps {
  onExtract: (payload: { html?: string; options: ExtractionOptions }) => Promise<void>;
  isLoading: boolean;
  onSwitchToAi: () => void;
  onBatchPreviewTable?: (table: ExtractedTable, pageTitle: string, sourceUrl: string) => void;
  onBatchFinished?: (allTables: ExtractedTable[], items: BatchUrlItem[]) => void;
}

export const ExtractorInput: React.FC<ExtractorInputProps> = ({
  onExtract,
  isLoading,
  onSwitchToAi,
  onBatchPreviewTable,
  onBatchFinished,
}) => {
  const t = translations;
  const [activeTab, setActiveTab] = useState<'batch' | 'html' | 'file'>('batch');
  const [htmlInput, setHtmlInput] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [options, setOptions] = useState<ExtractionOptions>({
    cleanWhitespace: true,
    extractLinks: false,
    autoDetectHeaders: true,
    minRows: 1,
    stealthMode: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!htmlInput.trim()) return;
    await onExtract({ html: htmlInput.trim(), options });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setHtmlInput(content);
        setActiveTab('html');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-7 space-y-4">
      {/* Input Mode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('batch')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'batch'
                ? 'bg-white text-indigo-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>{t.batchTab}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('html')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'html'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-4 h-4 text-emerald-600" />
            <span>{t.htmlTab}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('file');
              fileInputRef.current?.click();
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'file'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-purple-600" />
            <span>{t.fileUploadTab}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Stealth Mode Toggle */}
          <button
            type="button"
            onClick={() =>
              setOptions((prev) => ({
                ...prev,
                stealthMode: prev.stealthMode === false ? true : false,
              }))
            }
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
              options.stealthMode !== false
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs hover:bg-emerald-100'
                : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
            }`}
            title="Toggle Stealth Mode (Apify got-scraping + HTTP/2 + HopTrace)"
          >
            {options.stealthMode !== false ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Stealth Mode: ON</span>
              </>
            ) : (
              <>
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                <span>Stealth Mode: OFF</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              showOptions
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{t.optionsTitle}</span>
          </button>

          <button
            type="button"
            onClick={onSwitchToAi}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>{t.aiParserTitle}</span>
          </button>
        </div>
      </div>

      {/* Options Drawer (Global across tabs) */}
      {showOptions && (
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {/* Stealth Mode Feature Banner */}
          <div className="sm:col-span-2 md:col-span-4 p-3.5 bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-blue-50/90 border border-emerald-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-emerald-600 text-white rounded-md shrink-0 mt-0.5 shadow-2xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                    Stealth Mode (Apify got-scraping + HTTP/2 + HopTrace)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
                    {options.stealthMode !== false ? 'Active · Anti-Bot Bypass' : 'Disabled · Normal Fetch'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  تجاوز حظر المواقع عبر محاكاة بصمة متصفح حقيقي (Chrome / Edge TLS JA3) + تفعيل HTTP/2 + تتبع مسار التحويلات قفزة بقفزة (HopTrace حتى 10 قفزات) لتجاوز حظر Cloudflare و Akamai.
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0 self-end sm:self-center">
              <input
                type="checkbox"
                checked={options.stealthMode !== false}
                onChange={(e) =>
                  setOptions({ ...options, stealthMode: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={options.cleanWhitespace}
              onChange={(e) =>
                setOptions({ ...options, cleanWhitespace: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <span className="text-slate-700">{t.cleanWhitespace}</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={options.extractLinks}
              onChange={(e) =>
                setOptions({ ...options, extractLinks: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <span className="text-slate-700">{t.extractLinks}</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={options.autoDetectHeaders}
              onChange={(e) =>
                setOptions({ ...options, autoDetectHeaders: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <span className="text-slate-700">{t.autoDetectHeaders}</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={options.extractRowStatus ?? true}
              onChange={(e) =>
                setOptions({ ...options, extractRowStatus: e.target.checked })
              }
              className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
            />
            <span className="text-slate-700">Extract Row Tags & Colors (e.g. NotRecommended)</span>
          </label>

          <div className="flex items-center gap-2">
            <span className="text-slate-700 whitespace-nowrap">{t.minRows}:</span>
            <input
              type="number"
              min={1}
              max={50}
              value={options.minRows}
              onChange={(e) =>
                setOptions({
                  ...options,
                  minRows: Math.max(1, parseInt(e.target.value) || 1),
                })
              }
              className="w-16 h-7 px-2 border border-slate-300 rounded bg-white text-slate-800 text-xs font-mono"
            />
          </div>

          <div className="sm:col-span-2 md:col-span-4 pt-2 border-t border-slate-200">
            <label className="block text-slate-700 font-medium mb-1">
              {t.targetHeaderLabel}
            </label>
            <input
              type="text"
              value={options.targetHeaderKeyword || ''}
              onChange={(e) =>
                setOptions({ ...options, targetHeaderKeyword: e.target.value })
              }
              placeholder={t.targetHeaderPlaceholder}
              className="w-full h-8 px-3 border border-slate-300 rounded bg-white text-slate-800 text-xs font-mono outline-none focus:border-blue-500"
            />
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm,.txt"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Mode 1: Batch Processing Mode */}
      {activeTab === 'batch' ? (
        <BatchProcessor
          options={options}
          onSelectTableForPreview={(table, pageTitle, sourceUrl) => {
            if (onBatchPreviewTable) {
              onBatchPreviewTable(table, pageTitle, sourceUrl);
            }
          }}
          onBatchFinished={onBatchFinished}
        />
      ) : (
        /* Mode 2: Raw HTML / File Form */
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            {fileName && (
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span>Selected file:</span>
                <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  {fileName}
                </span>
              </div>
            )}
            <textarea
              dir="ltr"
              value={htmlInput}
              onChange={(e) => setHtmlInput(e.target.value)}
              placeholder={t.htmlPlaceholder}
              disabled={isLoading}
              rows={6}
              className="w-full p-4 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-800 placeholder-slate-400 text-xs font-mono transition-all outline-none resize-y"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isLoading || !htmlInput.trim()}
                className="h-11 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors shrink-0 shadow-xs cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t.extracting}</span>
                  </>
                ) : (
                  <>
                    <span>{t.extractBtn}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
