const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const quantity = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

export const formatMoney = (value: number) => currency.format(value);
export const formatQuantity = (value: number) => quantity.format(value);

export function formatCnpj(value: string | null | undefined): string {
  if (!value) return 'origem desconhecida';
  return /^\d{14}$/.test(value)
    ? value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : value;
}

/** Confiança do modelo como indicação, nunca como garantia. */
export const formatConfidence = (value: number) => `${Math.round(value * 100)}%`;
