export interface TableCell {
  text: string;
  link?: string;
  isHeader?: boolean;
}

export interface ExtractedTable {
  id: string;
  index: number;
  name: string;
  headers: string[];
  rows: string[][];
  rowStyles?: { className?: string; color?: string; bgColor?: string; tag?: string; hexBg?: string; hexColor?: string }[];
  rowCount: number;
  colCount: number;
  rawHtmlSnippet?: string;
}

export interface HopTraceItem {
  hop: number;
  url: string;
  statusCode: number;
  redirectLocation?: string;
  timingMs?: number;
}

export interface ExtractionResult {
  sourceType: 'url' | 'html';
  sourceUrl?: string;
  pageTitle: string;
  tables: ExtractedTable[];
  extractedAt: string;
  hops?: HopTraceItem[];
}

export interface ExtractionOptions {
  cleanWhitespace: boolean;
  extractLinks: boolean;
  minRows: number;
  autoDetectHeaders: boolean;
  targetHeaderKeyword?: string;
  extractRowStatus?: boolean;
  stealthMode?: boolean; // Apify got-scraping + TLS/HTTP2 + HopTrace
}

export interface CsvExportOptions {
  delimiter: ',' | ';' | '\t';
  includeBom: boolean; // UTF-8 BOM for Excel
  quoteStrings: boolean;
  customFileName?: string;
}

export interface BatchUrlItem {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  pageTitle?: string;
  tables: ExtractedTable[];
  error?: string;
  tableCount?: number;
  hops?: HopTraceItem[];
}

export interface BatchProcessingSummary {
  totalUrls: number;
  completedUrls: number;
  totalTables: number;
  totalRows: number;
  items: BatchUrlItem[];
}
