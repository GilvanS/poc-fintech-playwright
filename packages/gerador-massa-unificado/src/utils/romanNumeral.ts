const VALOR_PARA_NUMERAL: Array<[number, string]> = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function toRoman(numero: number): string {
  if (numero <= 0) return '';
  for (const [valor, numeral] of VALOR_PARA_NUMERAL) {
    if (numero >= valor) {
      return numero === valor ? numeral : numeral + toRoman(numero - valor);
    }
  }
  return '';
}
