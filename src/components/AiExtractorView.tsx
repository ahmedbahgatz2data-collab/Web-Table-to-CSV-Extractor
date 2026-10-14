import React, { useState } from 'react';
import { translations } from '../utils/i18n.js';
import { ExtractedTable } from '../types/table.js';
import { Sparkles, Loader2, ArrowRight, Lightbulb } from 'lucide-react';

interface AiExtractorViewProps {
  onSuccess: (tables: ExtractedTable[], title: string) => void;
  onCancel: () => void;
}

export const AiExtractorView: React.FC<AiExtractorViewProps> = ({
  onSuccess,
  onCancel,
}) => {
  const t = translations;
  const [content, setContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sampleAiSnippets = [
    {
      title: 'Unstructured Financial Memo',
      text: `March Sales Report:
Alexandria branch achieved sales of 450,000 EGP with 12% growth, managed by Mr. Tarek.
Giza branch achieved 680,000 EGP with 18% growth, managed by Mr. Sameh.
Maadi branch achieved 910,000 EGP with 25% growth, managed by Dr. Hanaa.
Nasr City branch achieved 720,000 EGP with 15% growth, managed by Mr. Khaled.`
    },
    {
      title: 'Pricing Tier Cards',
      text: `<div class="pricing-card">
  <h3>Basic Plan</h3>
  <span class="price">$19/mo</span>
  <p>Users: Up to 5 members, Storage: 50 GB, Support: Email</p>
</div>
<div class="pricing-card">
  <h3>Pro Plan</h3>
  <span class="price">$49/mo</span>
  <p>Users: Up to 20 members, Storage: 200 GB, Support: Priority</p>
</div>
<div class="pricing-card">
  <h3>Enterprise Plan</h3>
  <span class="price">$199/mo</span>
  <p>Users: Unlimited, Storage: 1 TB, Support: Dedicated Manager</p>
</div>`
    }
  ];

  const handleAiExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/ai-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          prompt: prompt.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'AI extraction failed');
      }

      if (!data.tables || data.tables.length === 0) {
        throw new Error('AI could not detect any tabular patterns in this text.');
      }

      onSuccess(data.tables, data.pageTitle || 'AI Extracted Table');
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || 'Processing failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <span>{t.aiParserTitle}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">{t.aiParserDesc}</p>
        </div>
        <button
          onClick={onCancel}
          className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Back to Extractor
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleAiExtract} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Unstructured Text or HTML Snippet:
          </label>
          <textarea
            dir="auto"
            rows={7}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste any text, messy div containers, or paragraphs that you want to convert into a table..."
            className="w-full p-3.5 text-xs rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-900 placeholder-slate-400 font-mono outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Additional AI Instructions (Optional):
          </label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t.aiPromptPlaceholder}
            className="w-full h-10 px-3 text-xs rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-900 placeholder-slate-400 outline-none"
          />
        </div>

        {/* Quick Sample Snippets */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600 pt-1">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="font-medium text-slate-500">Quick AI Prompts:</span>
          {sampleAiSnippets.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setContent(sample.text)}
              className="text-xs px-2.5 py-1 bg-indigo-50/70 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 rounded-md transition-colors cursor-pointer"
            >
              {sample.title}
            </button>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isLoading || !content.trim()}
            className="h-11 px-6 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shrink-0 shadow-xs cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing & Extracting...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{t.aiExtractBtn}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
