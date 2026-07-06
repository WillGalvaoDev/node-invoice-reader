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

  // Função auxiliar para converter o arquivo local no formato que o SDK do Gemini exige
  private fileToGenerativePart(filePath: string) {
    const ext = path.extname(filePath).toLowerCase();
    
    // Mapeia os Mime Types aceitos
    let mimeType = 'text/plain';
    if (ext === '.png') mimeType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    if (ext === '.pdf') mimeType = 'application/pdf';

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

    const basePrompt = `Você é um especialista em documentos fiscais brasileiros.
Análise o arquivo de DANFE (Nota Fiscal Eletrônica) fornecido em anexo e extraia as informações estruturadas necessárias para alimentar um sistema de controle de estoque.`;

    // Prepara o arquivo (carrega o binário em base64 com o mimeType correto)
    const filePart = this.fileToGenerativePart(filePath);

    // Passamos tanto o texto do prompt quanto o objeto de mídia dentro da array de contents
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