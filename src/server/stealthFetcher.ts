import { gotScraping } from 'got-scraping';
import type { HopTraceItem } from '../types/table.js';
export type { HopTraceItem };

export interface StealthFetchResult {
  success: boolean;
  html: string;
  finalUrl: string;
  statusCode: number;
  hops: HopTraceItem[];
  error?: string;
  usedStealth: boolean;
}

/**
 * Parses and merges 'set-cookie' headers into a standard Cookie header string
 */
function updateCookieJar(cookieJar: Map<string, string>, setCookieHeaders?: string | string[]): void {
  if (!setCookieHeaders) return;
  const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const cookieStr of list) {
    const parts = cookieStr.split(';')[0];
    const equalIdx = parts.indexOf('=');
    if (equalIdx > 0) {
      const key = parts.slice(0, equalIdx).trim();
      const val = parts.slice(equalIdx + 1).trim();
      if (key) {
        cookieJar.set(key, val);
      }
    }
  }
}

function serializeCookieJar(cookieJar: Map<string, string>): string | undefined {
  if (cookieJar.size === 0) return undefined;
  return Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/**
 * Fetches a web page using Apify's got-scraping with:
 * - HTTP/2 and TLS / JA3 emulation
 * - Realistic Chrome / Edge desktop header generation
 * - Manual hop-by-hop redirect tracking (HopTrace) up to maxHops (default 10)
 */
export async function fetchWithStealth(
  targetUrl: string,
  options: {
    maxHops?: number;
    timeoutMs?: number;
  } = {}
): Promise<StealthFetchResult> {
  const maxHops = options.maxHops ?? 10;
  const timeoutMs = options.timeoutMs ?? 20000;

  const hops: HopTraceItem[] = [];
  const cookieJar = new Map<string, string>();

  let currentUrl = targetUrl;
  let previousUrl: string | undefined = undefined;

  for (let hopIndex = 0; hopIndex < maxHops; hopIndex++) {
    const startTime = Date.now();
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(currentUrl);
    } catch {
      return {
        success: false,
        html: '',
        finalUrl: currentUrl,
        statusCode: 400,
        hops,
        error: `الرابط غير صالح أثناء تتبع التحويل: ${currentUrl}`,
        usedStealth: true,
      };
    }

    // Determine realistic referer:
    // Hop 0: Target origin or google search
    // Hop 1+: Previous hop URL
    const referer = previousUrl || `${parsedUrl.origin}/`;

    const cookieHeader = serializeCookieJar(cookieJar);

    try {
      const response = await gotScraping({
        url: currentUrl,
        http2: true,
        headerGeneratorOptions: {
          browsers: [
            { name: 'chrome', minVersion: 120 },
            { name: 'edge', minVersion: 120 },
          ],
          operatingSystems: ['windows', 'macos'],
          devices: ['desktop'],
          locales: ['en-US', 'en'],
        },
        headers: {
          'Referer': referer,
          'Accept':
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': hopIndex === 0 ? 'none' : 'same-origin',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0',
          ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
        },
        followRedirect: false,
        throwHttpErrors: false,
        timeout: {
          request: timeoutMs,
        },
        retry: {
          limit: 1,
        },
      });

      const elapsed = Date.now() - startTime;
      const statusCode = response.statusCode;

      // Update cookies
      const rawSetCookie = response.headers['set-cookie'];
      updateCookieJar(cookieJar, rawSetCookie);

      const isRedirect =
        [301, 302, 303, 307, 308].includes(statusCode) &&
        Boolean(response.headers.location);

      if (isRedirect) {
        const rawLocation = response.headers.location as string;
        let nextUrl: string;
        try {
          nextUrl = new URL(rawLocation, currentUrl).href;
        } catch {
          nextUrl = rawLocation;
        }

        hops.push({
          hop: hopIndex + 1,
          url: currentUrl,
          statusCode,
          redirectLocation: nextUrl,
          timingMs: elapsed,
        });

        previousUrl = currentUrl;
        currentUrl = nextUrl;
        continue;
      }

      // Final non-redirect response reached
      hops.push({
        hop: hopIndex + 1,
        url: currentUrl,
        statusCode,
        timingMs: elapsed,
      });

      const body = response.body || '';

      if (statusCode >= 200 && statusCode < 400) {
        return {
          success: true,
          html: body,
          finalUrl: currentUrl,
          statusCode,
          hops,
          usedStealth: true,
        };
      }

      // If status code is 4xx or 5xx, check if there's still an HTML body that contains tables
      return {
        success: body.includes('<table') || body.includes('role="table"'),
        html: body,
        finalUrl: currentUrl,
        statusCode,
        hops,
        error: `استجاب الموقع برمز (HTTP ${statusCode}). قد يتطلب الموقع إذناً خاصاً أو تسجيل دخول.`,
        usedStealth: true,
      };
    } catch (err: unknown) {
      const error = err as Error;
      const elapsed = Date.now() - startTime;
      hops.push({
        hop: hopIndex + 1,
        url: currentUrl,
        statusCode: 0,
        timingMs: elapsed,
      });

      return {
        success: false,
        html: '',
        finalUrl: currentUrl,
        statusCode: 0,
        hops,
        error: `خطأ في الاتصال بالسيرفر أثناء قفزة التحويل (${error.message || 'Connection failed'}).`,
        usedStealth: true,
      };
    }
  }

  return {
    success: false,
    html: '',
    finalUrl: currentUrl,
    statusCode: 310,
    hops,
    error: `تجاوز الموقع الحد الأقصى لقفزات التحويل (${maxHops} Hops). قد يكون هناك حلقة تحويل غير منتهية (Redirect Loop).`,
    usedStealth: true,
  };
}

/**
 * Standard fetch fallback without Apify got-scraping when Stealth Mode is toggled off
 */
export async function fetchStandard(targetUrl: string, timeoutMs = 18000): Promise<StealthFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = Date.now();

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
      },
      redirect: 'follow',
    });

    clearTimeout(timer);
    const html = await res.text();
    const elapsed = Date.now() - startTime;

    return {
      success: res.ok,
      html,
      finalUrl: res.url || targetUrl,
      statusCode: res.status,
      hops: [
        {
          hop: 1,
          url: targetUrl,
          statusCode: res.status,
          redirectLocation: res.url !== targetUrl ? res.url : undefined,
          timingMs: elapsed,
        },
      ],
      usedStealth: false,
      error: res.ok ? undefined : `تعذر جلب الصفحة (HTTP ${res.status}: ${res.statusText})`,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const error = err as Error;
    return {
      success: false,
      html: '',
      finalUrl: targetUrl,
      statusCode: 0,
      hops: [],
      usedStealth: false,
      error: `فشل الاتصال بالموقع (${error.message || 'Network error'}).`,
    };
  }
}
