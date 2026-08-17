import { GoogleGenAI, Type } from '@google/genai';
import {
  FieldSchema,
  TableSchema,
  ParseDocumentInput,
  ParseDocumentResponse,
  ExtractedFieldResult,
  AIProvider,
} from './ai/types';
import { ALL_TABLE_SCHEMAS, getTableSchema } from './ai/tableSchemas';
import { defaultGeminiProvider, GeminiAIProvider } from './ai/geminiProvider';
import { aiManager } from './ai/aiManager';

// Initialize the Google Generative AI client using GEMINI_API_KEY from process.env
const apiKey = (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) || '';
export const genAIClient = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

/**
 * Interface para opções de processamento de arquivos via IA
 */
export interface DocumentProcessingOptions {
  fileBase64: string;
  mimeType: string;
  fileName?: string;
  targetTableKey: string;
  customSchema?: TableSchema;
}

/**
 * Interface para mapeamento e resultado de um campo extraído
 */
export interface FieldMapping {
  key: string;
  label: string;
  type: string;
  value: any;
  status: 'matched' | 'missing' | 'unrecognized';
  description?: string;
}

/**
 * Interface para o resultado completo da extração de documentos
 */
export interface DocumentParseResult {
  success: boolean;
  tableKey: string;
  tableName: string;
  data: Record<string, any>;
  mappings: FieldMapping[];
  ignoredData: string[];
  providerId: string;
  rawText?: string;
  error?: string;
}

/**
 * Interface extensível para Provedores de IA (Gemini, OpenAI, Claude, etc.)
 */
export interface IAIModelProvider {
  id: string;
  name: string;
  processDocument(options: DocumentProcessingOptions): Promise<DocumentParseResult>;
}

/**
 * Provedor do Google Generative AI (Gemini 3.6 Flash / 1.5 Flash) implementando IAIModelProvider
 */
export class GeminiModelProvider implements IAIModelProvider {
  readonly id = 'gemini-1.5-flash';
  readonly name = 'Google Gemini 1.5 Flash';

  private provider = defaultGeminiProvider;

  async processDocument(options: DocumentProcessingOptions): Promise<DocumentParseResult> {
    const schema = options.customSchema || getTableSchema(options.targetTableKey);

    const input: ParseDocumentInput = {
      fileBase64: options.fileBase64,
      mimeType: options.mimeType,
      fileName: options.fileName,
      tableSchema: schema,
    };

    const response: ParseDocumentResponse = await this.provider.parseDocument(input);

    const mappings: FieldMapping[] = (response.fields || []).map((f: ExtractedFieldResult) => ({
      key: f.fieldKey,
      label: f.label,
      type: schema.fields.find((field) => field.key === f.fieldKey)?.type || 'string',
      value: f.extractedValue,
      status: f.status,
    }));

    return {
      success: response.success,
      tableKey: response.tableKey || options.targetTableKey,
      tableName: response.tableName || schema.tableName,
      data: response.extractedData || {},
      mappings,
      ignoredData: response.ignoredDocumentData || [],
      providerId: this.id,
      rawText: response.rawResponseText,
      error: response.error,
    };
  }
}

/**
 * Serviço modular principal para orquestração de Inteligência Artificial
 * Permite alternar e estender entre diferentes IAs no futuro
 */
export class AIService {
  private providers: Map<string, IAIModelProvider> = new Map();
  private activeProviderId: string = 'gemini-1.5-flash';

  constructor() {
    // Registrar o provedor padrão Gemini (Google Generative AI)
    const gemini = new GeminiModelProvider();
    this.registerProvider(gemini);
  }

  /**
   * Registra um novo provedor de IA no serviço
   */
  registerProvider(provider: IAIModelProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Retorna a lista de provedores registrados
   */
  getAvailableProviders(): { id: string; name: string }[] {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
    }));
  }

  /**
   * Define a IA ativa para processamento
   */
  setActiveProvider(providerId: string): boolean {
    if (this.providers.has(providerId)) {
      this.activeProviderId = providerId;
      return true;
    }
    return false;
  }

  /**
   * Retorna o ID do provedor ativo
   */
  getActiveProviderId(): string {
    return this.activeProviderId;
  }

  /**
   * Retorna os esquemas de tabela suportados para mapeamento
   */
  getTableSchemas(): Record<string, TableSchema> {
    return ALL_TABLE_SCHEMAS;
  }

  /**
   * Processa e analisa um documento usando a IA ativa configurada
   */
  async parseDocument(options: DocumentProcessingOptions): Promise<DocumentParseResult> {
    const provider = this.providers.get(this.activeProviderId) || this.providers.get('gemini-1.5-flash');

    if (!provider) {
      return {
        success: false,
        tableKey: options.targetTableKey,
        tableName: options.targetTableKey,
        data: {},
        mappings: [],
        ignoredData: [],
        providerId: 'unknown',
        error: 'Nenhum provedor de IA configurado no sistema.',
      };
    }

    return provider.processDocument(options);
  }
}

/**
 * Instância única (Singleton) do serviço de IA para uso em toda a aplicação
 */
export const aiService = new AIService();

/**
 * Função assíncrona para processar arquivos de imagem/PDF com contexto de tabela (nome e campos)
 * Retornando um objeto estruturado através do SDK do Google Generative AI (gemini-1.5-flash).
 */
export async function processDocumentWithAI(
  fileInput: string,
  mimeTypeInput: string,
  tableNameOrKey: string,
  fields?: FieldSchema[],
  fileName?: string
): Promise<DocumentParseResult> {
  let fileBase64 = fileInput;
  let mimeType = mimeTypeInput;

  // Se o fileInput for uma Data URL (ex: data:image/png;base64,...), extrair mimeType e base64 limpo
  if (fileInput.startsWith('data:')) {
    const matches = fileInput.match(/^data:(.+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      if (!mimeType || mimeType === 'application/octet-stream') {
        mimeType = matches[1];
      }
      fileBase64 = matches[2];
    }
  }

  const schema: TableSchema = fields
    ? {
        tableKey: tableNameOrKey,
        tableName: tableNameOrKey,
        description: `Tabela ${tableNameOrKey}`,
        fields,
      }
    : getTableSchema(tableNameOrKey);

  // Se a chave estiver disponível localmente e o SDK inicializado, executa diretamente via SDK
  if (genAIClient) {
    try {
      const filePart = {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: fileBase64,
        },
      };

      const systemPrompt = `Você é um assistente especialista na extração de dados para a tabela "${schema.tableName}".
Extraia apenas os campos configurados: ${JSON.stringify(schema.fields, null, 2)}.
Retorne um objeto JSON estrito no formato {"extractedData": {...}, "ignoredDocumentData": [...]}.`;

      const response = await genAIClient.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: {
          parts: [filePart, { text: systemPrompt }],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              extractedData: {
                type: Type.OBJECT,
                description: 'Objeto contendo apenas as chaves dos campos mapeados com seus valores convertidos.',
              },
              ignoredDocumentData: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Lista de dados encontrados no documento que foram ignorados por não existirem na tabela.',
              },
            },
            required: ['extractedData'],
          },
        },
      });

      const responseText = response.text || '{}';
      let parsedJson: { extractedData?: Record<string, any>; ignoredDocumentData?: string[] } = {};

      try {
        parsedJson = JSON.parse(responseText);
      } catch (e) {
        console.error('Erro ao analisar JSON retornado pelo Gemini:', responseText);
      }

      const extractedData = parsedJson.extractedData || {};
      const ignoredData = parsedJson.ignoredDocumentData || [];

      const mappings: FieldMapping[] = schema.fields.map((f) => {
        const val = extractedData[f.key];
        const hasMatch = val !== undefined && val !== null;
        return {
          key: f.key,
          label: f.label,
          type: f.type,
          value: hasMatch ? val : null,
          status: hasMatch ? 'matched' : 'missing',
        };
      });

      return {
        success: true,
        tableKey: schema.tableKey,
        tableName: schema.tableName,
        data: extractedData,
        mappings,
        ignoredData,
        providerId: 'gemini-1.5-flash',
        rawText: responseText,
      };
    } catch (err: any) {
      console.warn('Falha na chamada direta do SDK Gemini, utilizando rota de API do servidor:', err?.message);
    }
  }

  // Fallback para o serviço delegante (rota segura do servidor Express)
  return aiService.parseDocument({
    fileBase64,
    mimeType: mimeType || 'image/jpeg',
    fileName,
    targetTableKey: tableNameOrKey,
    customSchema: schema,
  });
}

export { ALL_TABLE_SCHEMAS, getTableSchema, aiManager };

