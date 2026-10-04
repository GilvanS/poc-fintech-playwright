import { DADOS_PADRAO } from '../src/repos.ts';
import { executarSemente } from '../src/semente/executar.ts';

// npm run semear             -> carrega os dados de exemplo (só se dados/ estiver vazio)
// npm run semear -- --forcar -> guarda uma cópia do que existe em dados/ e carrega os de exemplo
const forcar = process.argv.includes('--forcar');

executarSemente({ dirDados: DADOS_PADRAO, forcar })
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((erro: unknown) => {
    console.error('Não foi possível carregar a semente:', erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  });
