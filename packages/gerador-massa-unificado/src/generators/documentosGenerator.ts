export function calcularDigitoVerificadorCpf(digitos: number[], length: number): number {
  let soma = 0;
  for (let i = 0; i < length; i++) soma += digitos[i] * (length + 1 - i);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function gerarCpf(comPontuacao: boolean): string {
  const cpf: number[] = [];
  for (let i = 0; i < 9; i++) cpf.push(Math.floor(Math.random() * 10));
  cpf.push(calcularDigitoVerificadorCpf(cpf, 9));
  cpf.push(calcularDigitoVerificadorCpf(cpf, 10));
  const resultado = cpf.join('');
  return comPontuacao ? formatarCpf(resultado) : resultado;
}

export function calcularDigitoVerificadorCnpj(digitos: number[], length: number): number {
  let soma = 0;
  let peso = 2;
  for (let i = length - 1; i >= 0; i--) {
    soma += digitos[i] * peso;
    peso += 1;
    if (peso > 9) peso = 2;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function gerarCnpj(comPontuacao: boolean): string {
  const cnpj: number[] = [];
  for (let i = 0; i < 8; i++) cnpj.push(Math.floor(Math.random() * 10));
  cnpj.push(0, 0, 0, 1);
  cnpj.push(calcularDigitoVerificadorCnpj(cnpj, 12));
  cnpj.push(calcularDigitoVerificadorCnpj(cnpj, 13));
  const resultado = cnpj.join('');
  return comPontuacao ? formatarCnpj(resultado) : resultado;
}

export function formatarCpf(cpfSemPontuacao: string): string {
  if (!cpfSemPontuacao || cpfSemPontuacao.length !== 11) return cpfSemPontuacao;
  return `${cpfSemPontuacao.slice(0, 3)}.${cpfSemPontuacao.slice(3, 6)}.${cpfSemPontuacao.slice(6, 9)}-${cpfSemPontuacao.slice(9, 11)}`;
}

export function formatarCnpj(cnpjSemPontuacao: string): string {
  if (!cnpjSemPontuacao || cnpjSemPontuacao.length !== 14) return cnpjSemPontuacao;
  return `${cnpjSemPontuacao.slice(0, 2)}.${cnpjSemPontuacao.slice(2, 5)}.${cnpjSemPontuacao.slice(5, 8)}/${cnpjSemPontuacao.slice(8, 12)}-${cnpjSemPontuacao.slice(12, 14)}`;
}

export function gerarCep(comPontuacao: boolean): string {
  const numero = Math.floor(Math.random() * 99999999);
  const cep = String(numero).padStart(8, '0');
  return comPontuacao ? `${cep.slice(0, 5)}-${cep.slice(5, 8)}` : cep;
}
