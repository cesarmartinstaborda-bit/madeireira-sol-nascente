import { AIProvider, ParseDocumentInput, ParseDocumentResponse } from './types';
import { defaultGeminiProvider } from './geminiProvider';
import { ALL_TABLE_SCHEMAS, getTableSchema } from './tableSchemas';

export class AIManager {
  private providers: Map<string, AIProvider> = new Map();
  private activeProviderId: string = 'gemini-1.5-flash';

  constructor() {
    this.registerProvider(defaultGeminiProvider);
  }

  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  setActiveProvider(providerId: string): boolean {
    if (this.providers.has(providerId)) {
      this.activeProviderId = providerId;
      return true;
    }
    return false;
  }

  getActiveProvider(): AIProvider | undefined {
    return this.providers.get(this.activeProviderId) || this.providers.get('gemini-1.5-flash');
  }

  getAvailableProviders(): { id: string; name: string }[] {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
    }));
  }

  async parseDocument(input: ParseDocumentInput): Promise<ParseDocumentResponse> {
    const provider = this.getActiveProvider();
    if (!provider) {
      return {
        success: false,
        tableKey: input.tableSchema.tableKey,
        tableName: input.tableSchema.tableName,
        extractedData: {},
        fields: input.tableSchema.fields.map((f) => ({
          fieldKey: f.key,
          label: f.label,
          extractedValue: null,
          status: 'missing',
        })),
        error: 'Nenhum provedor de IA ativo encontrado.',
      };
    }

    return provider.parseDocument(input);
  }
}

export const aiManager = new AIManager();
