import React from 'react';
import { translations } from '../utils/i18n.js';
import { HelpCircle } from 'lucide-react';

interface NavbarProps {
  activeTab: 'extractor' | 'ai' | 'guide';
  onSelectTab: (tab: 'extractor' | 'ai' | 'guide') => void;
  onOpenGuide: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenGuide,
}) => {
  const t = translations;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark & Author Signature */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectTab('extractor')}
            className="text-lg font-bold tracking-tight text-slate-900 hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer text-start"
          >
            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-mono text-sm font-semibold shadow-sm">
              CSV
            </span>
            <span>TableExtractor</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-full shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs text-slate-600">
              By <span className="font-bold text-blue-700">ENG Ahmed Bahgat</span>
            </span>
          </div>
        </div>

        {/* Zone 2: Nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => onSelectTab('extractor')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'extractor' ? 'text-blue-600 font-semibold border-b-2 border-blue-600 pb-0.5' : 'hover:text-slate-900'
            }`}
          >
            {t.navExtractor}
          </button>
          <button
            onClick={() => onSelectTab('ai')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'ai' ? 'text-blue-600 font-semibold border-b-2 border-blue-600 pb-0.5' : 'hover:text-slate-900'
            }`}
          >
            {t.navAiParser}
          </button>
          <button
            onClick={onOpenGuide}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <HelpCircle className="w-4 h-4 text-slate-400" />
            {t.navGuide}
          </button>
        </nav>

        {/* Zone 3: Primary action & Mobile signature */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex sm:hidden items-center gap-1.5 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-[11px] font-semibold text-blue-700">
            <span>By ENG Ahmed Bahgat</span>
          </div>
          <button
            onClick={onOpenGuide}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            Documentation
          </button>
        </div>
      </div>
    </header>
  );
};
