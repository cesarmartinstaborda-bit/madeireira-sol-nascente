import { GoogleGenAI, Type } from '@google/genai';
import { AIProvider, ParseDocumentInput, ParseDocumentResponse, ExtractedFieldResult } from './types';

export class GeminiAIProvider implements AIProvider {
  readonly id = 'gemini-1.5-flash';
  readonly name = 'Google Gemini 1.5 Flash';

  private client: GoogleGenAI | null = null;

  constructor(apiKey?: string) {
    const key = apiKey || (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) || '';
    if (key) {
      this.client = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }

  async parseDocument(input: ParseDocumentInput): Promise<ParseDocumentResponse> {
    const { fileBase64, mimeType, tableSchema } = input;

    // Direct SDK execution if client with API key exists
    if (this.client) {
      try {
        const filePart = {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: fileBase64,
          },
        };

        const systemPrompt = `Você é um assistente especialista na leitura e extração de documentos para a tabela "${tableSchema.tableName}".
Analise visualmente a imagem/documento e preencha com precisão os seguintes campos esperados:
${JSON.stringify(tableSchema.fields, null, 2)}

Regras essenciais:
1. Converta datas para o padrão YYYY-MM-DD.
2. Converta valores monetários e números para formato numérico padrão (ex: 1250.50).
3. Ignore dados irrelevantes que não pertençam a nenhum dos campos da tabela e liste-os em "ignoredDocumentData".
4. Retorne apenas o JSON estruturado.`;

        const response = await this.client.models.generateContent({
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
                  description: 'Objeto contendo os campos extraídos mapeados.',
                },
                ignoredDocumentData: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Dados secundários no documento que foram ignorados.',
                },
              },
              required: ['extractedData'],
            },
          },
        });

        const rawText = response.text || '{}';
        let parsed: { extractedData?: Record<string, any>; ignoredDocumentData?: string[] } = {};
        try {
          parsed = JSON.parse(rawText);
        } catch {
          console.warn('Falha no parse do JSON direto do Gemini, resposta:', rawText);
        }

        const extractedData = parsed.extractedData || {};
        const ignoredDocumentData = parsed.ignoredDocumentData || [];

        const fields: ExtractedFieldResult[] = tableSchema.fields.map((f) => {
          const val = extractedData[f.key];
          const hasVal = val !== undefined && val !== null && val !== '';
          return {
            fieldKey: f.key,
            label: f.label,
            extractedValue: hasVal ? val : null,
            status: hasVal ? 'matched' : 'missing',
          };
        });

        return {
          success: true,
          tableKey: tableSchema.tableKey,
          tableName: tableSchema.tableName,
          extractedData,
          fields,
          ignoredDocumentData,
          rawResponseText: rawText,
        };
      } catch (err: any) {
        console.warn('Erro na chamada direta ao Gemini SDK, tentando fallback via API:', err?.message);
      }
    }

    // Fallback: try calling local proxy if available
    try {
      const apiRes = await fetch('/api/ai/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64,
          mimeType,
          tableKey: tableSchema.tableKey,
          schema: tableSchema,
        }),
      });

      if (apiRes.ok) {
        const json = await apiRes.json();
        return {
          success: true,
          tableKey: tableSchema.tableKey,
          tableName: tableSchema.tableName,
          extractedData: json.extractedData || {},
          fields: tableSchema.fields.map((f) => ({
            fieldKey: f.key,
            label: f.label,
            extractedValue: json.extractedData?.[f.key] ?? null,
            status: json.extractedData?.[f.key] !== undefined ? 'matched' : 'missing',
          })),
          ignoredDocumentData: json.ignoredDocumentData || [],
        };
      }
    } catch {
      // Ignore fallback failure
    }

    return {
      success: false,
      tableKey: tableSchema.tableKey,
      tableName: tableSchema.tableName,
      extractedData: {},
      fields: tableSchema.fields.map((f) => ({
        fieldKey: f.key,
        label: f.label,
        extractedValue: null,
        status: 'missing',
      })),
      ignoredDocumentData: [],
      error: 'Não foi possível conectar ao provedor de IA Gemini.',
    };
  }
}

export const defaultGeminiProvider = new GeminiAIProvider();
