# gerador-massa-unificado (port Node)

Port fiel de `gerador-massa-unificado-1.2.3.jar` (dependência interna Java, closed-source) para
TypeScript. Gera massa de dados de Usuario+Produto+Artigo em CSV, usando a API pública
[fakerapi.it](https://fakerapi.it) com fallback automático para geração local caso a API externa
esteja indisponível.

Especificação completa da engenharia reversa: `../../docs/plans/gerador-massa-unificado-especificacao.md`.

## Uso

```ts
import { gerarMassaUnificada } from 'gerador-massa-unificado';

await gerarMassaUnificada(10, 'output/massaDeTeste.csv');
```

Gera (ou acrescenta, se o arquivo já existir) `10` linhas no CSV, com 29 colunas separadas por `;`,
cada campo envolto em `="..."` (convenção Excel anti-notação-científica). Nomes de categoria e
títulos de artigo repetidos são desambiguados automaticamente com sufixo em numeral romano
(`Informatica`, `Informatica II`, `Informatica III`...).

## O que este pacote NÃO inclui (por ser código morto no jar original)

`RandomGenerator`, `GeradorDeTelefone`, `GeradorDeImei`, `GeradorDePlacaVeiculo`,
`AquisicaoApiClient` (+ DTOs), `CsvWriterService`/`CsvColumn`, `GeradorMassaService.gerarEProcessarArtigo`.
Nenhum desses é referenciado pelo pipeline real de `gerarMassaUnificada` no jar original — ver
seção "O que NÃO será portado" do plano de migração.
