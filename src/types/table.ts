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
  rowCount: number;
  colCount: number;
  rawHtmlSnippet?: string;
}

export interface ExtractionResult {
  sourceType: 'url' | 'html';
  sourceUrl?: string;
  pageTitle: string;
  tables: ExtractedTable[];
  extractedAt: string;
}

export interface ExtractionOptions {
  cleanWhitespace: boolean;
  extractLinks: boolean;
  minRows: number;
  autoDetectHeaders: boolean;
  targetHeaderKeyword?: string;
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
}

export interface BatchProcessingSummary {
  totalUrls: number;
  completedUrls: number;
  totalTables: number;
  totalRows: number;
  items: BatchUrlItem[];
}
