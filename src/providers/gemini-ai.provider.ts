import { GoogleGenAI, Type } from '@google/genai';
import type { GenerateContentParameters, GenerateContentResponse, Schema } from '@google/genai';
import type { IAiProvider, IDanfeExtractResult, ISimilarityMatch } from '../providers/ai.provider.js';
import type { IProduct } from '../repositories/product.repository.js';
import fs from 'node:fs/promises';
import { AppError } from '../errors/app-error.js';
import { env } from '../config/env.js';
import { isDanfeMimeType, type DanfeMimeType } from '../config/upload.js';

const RETRY_BASE_DELAY_MS = 250;

export class GeminiAiProvider implements IAiProvider {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }

  private async generateContent(parameters: GenerateContentParameters): Promise<GenerateContentResponse> {
    let lastError: unknown;

    for (let attempt = 0; attempt < env.GEMINI_MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), env.GEMINI_TIMEOUT_MS);

      try {
        return await this.ai.models.generateContent({
          ...parameters,
          config: {
            ...parameters.config,
            abortSignal: controller.signal,
            httpOptions: {
              ...parameters.config?.httpOptions,
              timeout: env.GEMINI_TIMEOUT_MS,
            },
          },
        });
      } catch (error) {
        lastError = error;
        const timedOut = controller.signal.aborted || this.isTimeoutError(error);
        const canRetry = timedOut || this.isTransientError(error);

        if (!canRetry || attempt === env.GEMINI_MAX_ATTEMPTS - 1) {
          throw this.toAppError(error, timedOut);
        }
      } finally {
        clearTimeout(timeout);
      }

      await this.delay(RETRY_BASE_DELAY_MS * 2 ** attempt);
    }

    throw this.toAppError(lastError, this.isTimeoutError(lastError));
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private isTransientError(error: unknown): boolean {
    const status = this.errorStatus(error);
    if (status === 429 || (status !== null && status >= 500 && status <= 599)) return true;

    if (!(error instanceof Error)) return false;
    const retryableCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH']);
    const code = 'code' in error && typeof error.code === 'string' ? error.code : null;
    return error.name === 'TypeError' || (code !== null && retryableCodes.has(code));
  }

  private isTimeoutError(error: unknown): boolean {
    return error instanceof Error && (
      error.name === 'AbortError' ||
      error.name === 'TimeoutError' ||
      error.name === 'APIConnectionTimeoutError'
    );
  }

  private errorStatus(error: unknown): number | null {
    return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
      ? error.status
      : null;
  }

  private toAppError(error: unknown, timedOut: boolean): AppError {
    if (timedOut) return new AppError('O serviço de IA excedeu o tempo limite.', 504);
    if (this.isTransientError(error)) return new AppError('O serviço de IA está temporariamente indisponível.', 503);
    return new AppError('Falha ao comunicar com o serviço de IA.', 502);
  }

  private parseJson(text: string | undefined): unknown {
    if (typeof text !== 'string' || text.trim() === '') {
      throw new AppError('O serviço de IA retornou uma resposta vazia.', 422);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new AppError('O serviço de IA retornou JSON inválido.', 422);
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private parseDanfeResponse(text: string | undefined): IDanfeExtractResult {
    const parsed = this.parseJson(text);
    if (
      !this.isRecord(parsed) ||
      typeof parsed.accessKey !== 'string' ||
      typeof parsed.invoiceNumber !== 'string' ||
      typeof parsed.series !== 'string' ||
      (typeof parsed.issuedAt !== 'string' && !(parsed.issuedAt instanceof Date)) ||
      typeof parsed.totalValue !== 'number' ||
      !this.isRecord(parsed.supplier) ||
      typeof parsed.supplier.cnpj !== 'string' ||
      typeof parsed.supplier.name !== 'string' ||
      !Array.isArray(parsed.products)
    ) {
      throw new AppError('O serviço de IA retornou dados incompatíveis com um DANFE.', 422);
    }
    return parsed as unknown as IDanfeExtractResult;
  }

  private parseSimilarityResponse(text: string | undefined): Record<string, unknown> {
    const parsed = this.parseJson(text);
    if (!this.isRecord(parsed) || typeof parsed.matchFound !== 'boolean') {
      throw new AppError('O serviço de IA retornou uma similaridade inválida.', 422);
    }
    if (parsed.matchFound && (
      typeof parsed.matchedProductId !== 'string' ||
      typeof parsed.confidence !== 'number' ||
      typeof parsed.reason !== 'string'
    )) {
      throw new AppError('O serviço de IA retornou uma similaridade inválida.', 422);
    }
    return parsed;
  }

  private async fileToGenerativePart(filePath: string, mimeType: DanfeMimeType) {
    if (!isDanfeMimeType(mimeType)) {
      throw new AppError('Tipo de arquivo não suportado.', 415);
    }

    const content = await fs.readFile(filePath);

    return {
      inlineData: {
        data: content.toString('base64'),
        mimeType
      },
    };
  }

  async extractDanfeData(filePath: string, mimeType: DanfeMimeType): Promise<IDanfeExtractResult> {
    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        accessKey: { type: Type.STRING, description: 'A chave de acesso de 44 dígitos do DANFE' },
        invoiceNumber: { type: Type.STRING, description: 'Número da nota fiscal' },
        series: { type: Type.STRING, description: 'Série da nota fiscal' },
        issuedAt: { type: Type.STRING, description: 'Data de emissão no formato ISO (YYYY-MM-DD)' },
        totalValue: { type: Type.NUMBER, description: 'Valor total da nota fiscal' },
        supplier: {
          type: Type.OBJECT,
          properties: {
            cnpj: { type: Type.STRING },
            name: { type: Type.STRING },
            stateRegistration: { type: Type.STRING }
          },
          required: ['cnpj', 'name']
        },
        products: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              code: { type: Type.STRING },
              description: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              unitPrice: { type: Type.NUMBER },
              totalPrice: { type: Type.NUMBER },
              unitMeasurement: { type: Type.STRING }
            },
            required: ['code', 'description', 'quantity', 'unitPrice', 'totalPrice', 'unitMeasurement']
          }
        }
      },
      required: ['accessKey', 'invoiceNumber', 'series', 'issuedAt', 'totalValue', 'supplier', 'products']
    };

    const basePrompt = `Você é um leitor óptico (OCR) de notas fiscais severo e exato.
Analise a imagem anexada e extraia EXATAMENTE os caracteres de texto que estão visíveis.

DIRETRIZES OBRIGATÓRIAS:
1. O EMITENTE/FORNECEDOR está no topo. Transcreva a Razão Social/Nome e o CNPJ exatamente como impressos. Não invente codinomes como "Serrana" ou "Empresa Modelo".
2. Olhe a tabela "DADOS DOS PRODUTOS / SERVIÇOS". Conte quantas linhas ela possui e transcreva UMA POR UMA. Se houver 8 itens, o seu array "products" DEVE conter exatamente 8 objetos.
3. Transcreva a descrição exata (ex: "BARRA CHATA 1\\" TRABALHADA").
4. Converta valores usando ponto para decimais (ex: 4059.20).

Estruture o JSON final seguindo rigorosamente o esquema.`;

    const filePart = await this.fileToGenerativePart(filePath, mimeType);

    const response = await this.generateContent({
      model: 'gemini-2.5-flash',
      contents: [basePrompt, filePart], 
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    });

    return this.parseDanfeResponse(response.text);
  }

  async findSimilarProduct(
    newItemDescription: string,
    existingProducts: IProduct[]
  ): Promise<ISimilarityMatch | null> {
    if (existingProducts.length === 0) return null;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        matchFound: { type: Type.BOOLEAN, description: 'Verdadeiro se encontrou um produto fisicamente equivalente no estoque' },
        matchedProductId: { type: Type.STRING, description: 'ID do produto correspondente encontrado ou string vazia' },
        confidence: { type: Type.NUMBER, description: 'Pontuação de confiança entre 0.0 e 1.0' },
        reason: { type: Type.STRING, description: 'Explicação do porquê os dois itens são ou não o mesmo produto' }
      },
      required: ['matchFound', 'matchedProductId', 'confidence', 'reason']
    };

    const productsListFormatted = existingProducts.map((p) => ({
      id: p.id,
      code: p.code,
      description: p.description,
    }));

    const prompt = `Você é um especialista em conciliação de estoque.
Analise a nova descrição de item extraída de uma nota fiscal: "${newItemDescription}".
Compare com a lista de produtos já cadastrados neste estoque:
${JSON.stringify(productsListFormatted, null, 2)}

Defina se a nova descrição refere-se fisicamente ao mesmo produto de algum item existente (exemplo: "OVOSX12", "OVOS DZ" e "Dúzia de Ovos" são o mesmo produto).
Defina matchFound=true APENAS se a confiança for maior ou igual a 0.70.`;

    try {
      const response = await this.generateContent({
        model: 'gemini-2.5-flash',
        contents: [prompt],
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        }
      });

      const parsed = this.parseSimilarityResponse(response.text);

      if (!parsed.matchFound || typeof parsed.matchedProductId !== 'string' || typeof parsed.confidence !== 'number' || parsed.confidence < 0.7) {
        return null;
      }

      const matchedProduct = existingProducts.find(
        (p) => p.id === parsed.matchedProductId
      );

      if (!matchedProduct) return null;

      return {
        product: matchedProduct,
        confidence: parsed.confidence,
        reason: parsed.reason as string,
      };
    } catch {
      return null;
    }
  }
}
