import { GoogleGenAI, Type } from '@google/genai';
import type { Schema } from '@google/genai';
import type { IAiProvider, IDanfeExtractResult } from './ai.provider.js';
import fs from 'node:fs';
import path from 'node:path';

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
3. Transcreva a descrição exata (ex: "BARRA CHATA 1\" TRABALHADA").
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
      throw new Error("O Gemini retornou uma resposta vazia.");
    }

    return JSON.parse(response.text) as IDanfeExtractResult;
  }
}