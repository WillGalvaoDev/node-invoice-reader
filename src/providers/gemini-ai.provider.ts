import { GoogleGenAI, Type, Schema } from '@google/genai';
import type { IAiProvider, IDanfeExtractResult } from './ai.provider.js';

export class GeminiAiProvider implements IAiProvider {
  private ai: GoogleGenAI;

  constructor() {
    // O SDK busca automaticamente a variável de ambiente process.env.GEMINI_API_KEY
    this.ai = new GoogleGenAI({});
  }

  async extractDanfeData(rawText: string): Promise<IDanfeExtractResult> {
    // Definimos o esquema rígido que o Gemini DEVE seguir na resposta
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

    const prompt = `
      Você é um especialista em documentos fiscais brasileiros. 
      Analise o texto extraído de um DANFE (Nota Fiscal Eletrônica) fornecido abaixo e extraia as informações estruturadas necessárias para alimentar um sistema de controle de estoque.
      
      Texto bruto do DANFE:
      ---
      ${rawText}
      ---
    `;

    // Chamamos o modelo flash, que é ultra veloz e gratuito no AI Studio
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.1 // Temperatura baixa para evitar alucinações e manter o modelo factual
      }
    });

    if (!response.text) {
      throw new Error('Gemini falhou em retornar uma resposta.');
    }

    // Como o Gemini garante o esquema, podemos dar o parse e o cast com segurança
    const data = JSON.parse(response.text);
    
    // Tratamos a conversão da string de data para um objeto Date real do JS
    return {
      ...data,
      issuedAt: new Date(data.issuedAt)
    };
  }
}