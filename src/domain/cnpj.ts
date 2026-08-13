const CANONICAL_CNPJ = /^[0-9A-Z]{12}[0-9]{2}$/;
const FORMATTED_CNPJ = /^([0-9A-Z]{2})\.([0-9A-Z]{3})\.([0-9A-Z]{3})\/([0-9A-Z]{4})-([0-9]{2})$/;
const LEGACY_REPEATED_DIGITS = /^(\d)\1{13}$/;

function characterValue(character: string): number {
  return character.charCodeAt(0) - 48;
}

function checkDigit(base: string): number {
  let weight = 2;
  let sum = 0;

  for (let index = base.length - 1; index >= 0; index--) {
    const character = base[index];
    if (character === undefined) throw new Error('CNPJ inválido.');
    sum += characterValue(character) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function normalizeCnpj(input: string): string {
  const value = input.trim().toUpperCase();
  if (CANONICAL_CNPJ.test(value)) return value;

  const match = FORMATTED_CNPJ.exec(value);
  if (!match) throw new Error('CNPJ inválido.');
  return match.slice(1).join('');
}

export function isValidCnpj(input: string): boolean {
  let cnpj: string;
  try {
    cnpj = normalizeCnpj(input);
  } catch {
    return false;
  }

  if (LEGACY_REPEATED_DIGITS.test(cnpj)) return false;
  const body = cnpj.slice(0, 12);
  const firstDigit = checkDigit(body);
  const secondDigit = checkDigit(`${body}${firstDigit}`);
  return cnpj.endsWith(`${firstDigit}${secondDigit}`);
}

export function parseCnpj(input: string): string {
  const cnpj = normalizeCnpj(input);
  if (!isValidCnpj(cnpj)) throw new Error('CNPJ inválido.');
  return cnpj;
}
