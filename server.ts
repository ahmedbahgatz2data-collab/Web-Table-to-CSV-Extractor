import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractTablesFromHtml } from './src/utils/tableExtractor.js';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.NODE_ENV === 'production' ? (process.env.PORT || 3000) : 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

/**
 * Health check endpoint
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Table extraction endpoint
 */
app.post('/api/extract', async (req, res) => {
  try {
    const { url, html, options = {} } = req.body;

    let targetHtml = '';
    let resolvedTitle = '';
    let sourceUrl = '';

    if (url && typeof url === 'string') {
      let fetchUrl = url.trim();
      if (!/^https?:\/\//i.test(fetchUrl)) {
        fetchUrl = 'https://' + fetchUrl;
      }

      try {
        new URL(fetchUrl);
      } catch {
        return res.status(400).json({
          success: false,
          error: 'الرابط المدخل غير صالح. يرجى التأكد من كتابة الرابط بشكل صحيح (The entered URL is invalid).'
        });
      }

      sourceUrl = fetchUrl;

      // Fetch with desktop browser headers
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      try {
        const response = await fetch(fetchUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept':
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          return res.status(400).json({
            success: false,
            error: `تعذر جلب الصفحة (HTTP ${response.status}: ${response.statusText}). قد تمنع الصفحة الوصول المباشر. يمكنك نسخ كود HTML ولصقه يدوياً في خانة كود HTML.`
          });
        }

        targetHtml = await response.text();
      } catch (fetchErr: unknown) {
        clearTimeout(timeoutId);
        const err = fetchErr as Error;
        const isTimeout = err.name === 'AbortError';
        return res.status(500).json({
          success: false,
          error: isTimeout
            ? 'انتهت مهلة الاتصال بالصفحة (Connection timed out). يمكنك محاولة لصق كود HTML مباشرة.'
            : `فشل الاتصال بالموقع (${err.message || 'Network error'}). يمكنك نسخ محتوى الصفحة ولصقه في تبويب "لصق HTML".`
        });
      }
    } else if (html && typeof html === 'string') {
      targetHtml = html;
      sourceUrl = 'HTML Snippet';
    } else {
      return res.status(400).json({
        success: false,
        error: 'يرجى تزويد رابط صفحة ويب أو كود HTML لاستخراج الجداول منه.'
      });
    }

    if (!targetHtml || targetHtml.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'المحتوى المستلم فارغ، لم يتم العثور على أي كود صفحة.'
      });
    }

    // Parse tables
    const result = extractTablesFromHtml(targetHtml, options);
    resolvedTitle = result.pageTitle || 'Extracted Tables';

    return res.json({
      success: true,
      pageTitle: resolvedTitle,
      sourceUrl,
      tableCount: result.tables.length,
      tables: result.tables,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Extraction error:', err);
    return res.status(500).json({
      success: false,
      error: `حدث خطأ أثناء معالجة الصفحة: ${err.message || 'Unknown error'}`
    });
  }
});

/**
 * AI Table Extraction endpoint using Gemini Flash
 */
app.post('/api/ai-extract', async (req, res) => {
  try {
    const { content, prompt = 'Extract all tabular data from this content into clean structured tables.' } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'يرجى تقديم محتوى لتحليله بواسطة الذكاء الاصطناعي.'
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: 'مفتاح Gemini API غير مهيأ في الخادم (GEMINI_API_KEY is not configured).'
      });
    }

    const ai = new GoogleGenAI();
    // Truncate to reasonable length to avoid exceeding tokens if raw html is gigantic
    const maxContent = content.slice(0, 50000);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are an expert data scraper and table extraction specialist.
Analyze the following text or HTML and extract all tables or structured tabular datasets.
Return ONLY valid JSON matching this schema:
{
  "pageTitle": "Short title or topic name",
  "tables": [
    {
      "name": "Descriptive title of table (in Arabic or English depending on source)",
      "headers": ["Col 1", "Col 2", ...],
      "rows": [
        ["val1", "val2", ...],
        ...
      ]
    }
  ]
}

Instructions:
- Keep numbers clean and aligned.
- Normalize empty or missing cells with empty string "".
- If cell values are in Arabic, preserve exact Arabic characters cleanly.
- If there are multiple distinct data sets or comparison tables, extract each as a separate item in the "tables" array.
- Do NOT output markdown ticks like \`\`\`json. Output pure JSON only.

User instruction: ${prompt}

Content to parse:
${maxContent}`
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const responseText = response.text || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      // Clean possible fences
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    }

    const formattedTables = (parsedData.tables || []).map((t: any, idx: number) => ({
      id: `ai-table-${idx + 1}`,
      index: idx + 1,
      name: t.name || `جدول ${idx + 1}`,
      headers: t.headers || [],
      rows: t.rows || [],
      rowCount: (t.rows || []).length,
      colCount: (t.headers || []).length,
    }));

    return res.json({
      success: true,
      pageTitle: parsedData.pageTitle || 'AI Extracted Data',
      sourceUrl: 'AI Semantic Parser',
      tableCount: formattedTables.length,
      tables: formattedTables
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('AI extraction error:', err);
    return res.status(500).json({
      success: false,
      error: `فشل التحليل الذكي: ${err.message || 'AI extraction failed'}`
    });
  }
});

/**
 * Start server with Vite middleware in dev or static files in production
 */
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
