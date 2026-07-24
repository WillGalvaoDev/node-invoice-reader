import { GoogleGenAI, Type } from '@google/genai';
import type { Schema } from '@google/genai';
import type { IAiProvider, IDanfeExtractResult, ISimilarityMatch } from '../providers/ai.provider.js';
import type { IProduct } from '../repositories/product.repository.js';
import fs from 'node:fs';
import path from 'node:path';
import { AppError } from '../errors/app-error.js';

export class GeminiAiProvider implements IAiProvider {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({});
  }

  private fileToGenerativePart(filePath: string) {
    const ext = path.extname(filePath).toLowerCase();
    
    let mimeType = 'image/jpeg'; // Fallback seguro para imagens
    if (ext === '.png') mimeType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    if (ext === '.pdf') mimeType = 'application/pdf';

    console.log(`[GeminiAI] Processando arquivo: ${filePath} com MimeType: ${mimeType}`);

    return {
      inlineData: {
        data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
        mimeType
      },
    };
  }

  async extractDanfeData(filePath: string): Promise<IDanfeExtractResult> {
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

    const filePart = this.fileToGenerativePart(filePath);

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [basePrompt, filePart], 
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    });

    if (!response.text) {
      throw new AppError('Não foi possível extrair dados da nota fiscal fornecida.', 422);
    }

    return JSON.parse(response.text) as IDanfeExtractResult;
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
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [prompt],
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        }
      });

      if (!response.text) return null;

      const parsed = JSON.parse(response.text);

      if (!parsed.matchFound || !parsed.matchedProductId || parsed.confidence < 0.7) {
        return null;
      }

      const matchedProduct = existingProducts.find(
        (p) => p.id === parsed.matchedProductId
      );

      if (!matchedProduct) return null;

      return {
        product: matchedProduct,
        confidence: parsed.confidence,
        reason: parsed.reason,
      };
    } catch (error) {
      console.error('[GeminiAI] Erro ao buscar produto similar:', error);
      return null;
    }
  }
}