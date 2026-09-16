export function capitalizar(palavra: string, tamanhoDesejado: number): string {
  const tamanho = Math.min(tamanhoDesejado, palavra.length);
  const trecho = palavra.slice(0, tamanho);
  return trecho.slice(0, 1).toUpperCase() + trecho.slice(1).toLowerCase();
}

export function gerarSenhaCustomizada(nomeCompleto: string | null, cpf: string | null): string {
  if (!nomeCompleto || !nomeCompleto.trim() || cpf === null) return 'SenhaInvalida';
  const nomes = nomeCompleto.trim().split(/\s+/);
  const primeiroNome = nomes[0];
  const ultimoNome = nomes.length > 1 ? nomes[nomes.length - 1] : primeiroNome;
  const parte1 = capitalizar(ultimoNome, 3);
  const parte2 = capitalizar(primeiroNome, 2);
  const cpfNumeros = cpf.replace(/\D/g, '');
  const parte3 = cpfNumeros.length >= 2 ? cpfNumeros.slice(-2) : cpfNumeros;
  return parte1 + parte2 + parte3;
}

export function gerarSenhaPadrao(): string {
  const numero = Math.floor(Math.random() * 1000);
  return `Password${String(numero).padStart(3, '0')}`;
}
