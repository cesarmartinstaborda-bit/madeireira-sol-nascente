export type FieldType = 'string' | 'number' | 'date' | 'boolean' | 'currency' | 'select';

export interface FieldSchema {
  key: string;
  label: string;
  type: FieldType;
  description?: string;
  required?: boolean;
  options?: string[];
  example?: string;
}

export interface TableSchema {
  tableKey: string;
  tableName: string;
  description?: string;
  fields: FieldSchema[];
}

export interface ParseDocumentInput {
  fileBase64: string;
  mimeType: string;
  fileName?: string;
  tableSchema: TableSchema;
}

export interface ExtractedFieldResult {
  fieldKey: string;
  label: string;
  extractedValue: any;
  confidence?: number;
  status: 'matched' | 'missing' | 'unrecognized';
}

export interface ParseDocumentResponse {
  success: boolean;
  tableKey: string;
  tableName: string;
  extractedData: Record<string, any>;
  fields: ExtractedFieldResult[];
  ignoredDocumentData?: string[];
  rawResponseText?: string;
  error?: string;
}

export interface AIProvider {
  id: string;
  name: string;
  parseDocument(input: ParseDocumentInput): Promise<ParseDocumentResponse>;
}
