import React from 'react';
import { X, CheckCircle2, ShieldAlert, FileSpreadsheet, Sparkles, BookOpen } from 'lucide-react';

interface HelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">
              Table Extraction & CSV Guide
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-600 leading-relaxed">
          {/* Section 1 */}
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>1. Batch URL Processing</span>
            </h4>
            <p>
              Paste multiple URLs (one per line) in the Batch URLs tab. The system extracts tables sequentially with live progress and lets you download a structured ZIP archive or a unified merged CSV with source attribution.
            </p>
          </div>

          {/* Section 2 */}
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>2. Protected or Login-Restricted Pages</span>
            </h4>
            <p>
              If a page requires login (like your internal corporate dashboard or behind authentication), simply open the page in your browser, right click and choose "View Source" or inspect table, copy the HTML and paste it into the "Paste Raw HTML" tab.
            </p>
          </div>

          {/* Section 3 */}
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <span>3. UTF-8 BOM Encoding in Microsoft Excel</span>
            </h4>
            <p>
              Exported CSV files automatically prepend a standard UTF-8 Byte Order Mark (BOM). This instructs Microsoft Excel to render Arabic text and Unicode characters properly without scrambled characters.
            </p>
          </div>

          {/* Section 4 */}
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>4. AI Smart Semantic Extractor</span>
            </h4>
            <p>
              If data is formatted using non-table divs, article bullet points, or complex layouts, use the AI Parser to intelligently structure it into standard tabular rows and columns.
            </p>
          </div>

          {/* Section 5: Stealth Mode */}
          <div className="space-y-1.5 p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>5. Stealth Mode (Apify got-scraping & HopTrace)</span>
            </h4>
            <p className="text-emerald-900">
              يستخدم التطبيق محرك <strong>got-scraping</strong> المطور بواسطة Apify لمحاكاة بصمة المتصفحات الحديثة (Chrome و Edge على Windows/macOS) مع تفعيل HTTP/2، وترويسات مطابقة للمتصفحات الحقيقية، وتتبع قفزات التحويل (HopTrace) حتى 10 قفزات لمعالجة الروابط التلقائية والنسبية وتخطي أنظمة الحماية ومكافحة البوتات مثل Cloudflare و Akamai.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Got it, Close
          </button>
        </div>
      </div>
    </div>
  );
};
