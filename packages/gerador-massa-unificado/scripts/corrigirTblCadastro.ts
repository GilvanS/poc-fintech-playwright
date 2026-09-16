import * as XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import { gerarDados, gerarUsuario } from 'gerador-massa-unificado';
import { formatarTabelas } from './formatarTabelasExcel';

/**
 * MIGRAÇÃO JÁ APLICADA — não precisa rodar de novo em uso normal do projeto.
 *
 * Corrigiu o schema da aba TBL_CADASTRO em data/MassaDados.xlsx: adicionou EMAIL e
 * NOME_USUARIO (faltavam — TestContext.ts tinha um workaround usando CPF no lugar de
 * email) e removeu BALANCE/valor_total/status, que são dado de TBL_CENARIOS (estado
 * pós-provisionamento), não de cadastro. Preserva SEQ/ID_MASSA/NOME_COMPLETO/CPF já
 * existentes — só ajusta o schema, não inventa gente nova.
 *
 * `XLSX.writeFile()` reescreve o workbook inteiro e não sabe reemitir Tabela do Excel —
 * é o que apagou a formatação de TBL_CADASTRO da primeira vez que este script rodou
 * (corrigido depois por formatarTabelasExcel.ts, rodado à parte). Pra não repetir o
 * problema se este script for executado de novo (ex: outra correção de schema no
 * futuro), agora ele chama formatarTabelas() automaticamente no final — nunca deixa o
 * arquivo sem a formatação.
 *
 *   npm run massa:cadastro:corrigir
 */
const CAMINHO = 'data/MassaDados.xlsx';
const ABA = 'TBL_CADASTRO';
const SENHA_PADRAO_TESTES = 'admin999';

function partesDoNome(nomeCompleto: string): string[] {
    return nomeCompleto
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

/** Mesma técnica de `buildEmail` do MainMassCreatorFlow.tsx (Massas 3.0): nome.sobrenome@fintech.com. */
function buildEmail(nomeCompleto: string): string {
    const partes = partesDoNome(nomeCompleto);
    if (!partes.length) return 'massa@fintech.com';
    const nome = partes[0];
    const sobrenome = partes.length > 1 ? partes[partes.length - 1] : '';
    return sobrenome ? `${nome}.${sobrenome}@fintech.com` : `${nome}@fintech.com`;
}

function buildNomeUsuario(nomeCompleto: string): string {
    const partes = partesDoNome(nomeCompleto);
    if (!partes.length) return 'usuario';
    const nome = partes[0];
    const sobrenome = partes.length > 1 ? partes[partes.length - 1] : '';
    return sobrenome ? `${nome}.${sobrenome}` : nome;
}

async function main(): Promise<void> {
    const caminhoAbsoluto = path.resolve(process.cwd(), CAMINHO);
    const workbook = XLSX.readFile(caminhoAbsoluto);
    const linhasAtuais = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[ABA]);

    console.log(`➕ Gerando dados randômicos e corrigindo schema de ${linhasAtuais.length} registros em '${ABA}' (${CAMINHO})...`);

    const linhasCorrigidas: Record<string, unknown>[] = [];
    const csvHeader = 'ID_MASSA;NOME_COMPLETO;NOME_USUARIO;EMAIL;SENHA;CPF;TELEFONE;CEP;RUA;NUMERO;BAIRRO;CIDADE;ESTADO;PAIS;DATA_NASCIMENTO;BANDEIRA_CARTAO;TIER_CARTAO;DIA_VENCIMENTO;NOME_IMPRESSO;PLANO_CONTA;CHAVE_PIX;NOME_TUTOR;CPF_TUTOR';
    const csvLines: string[] = [csvHeader];

    const formatCsvField = (v: unknown) => `="${String(v ?? '').replace(/"/g, '""')}"`;

    for (const linha of linhasAtuais) {
        const dadosApi = await gerarDados();
        const rand = gerarUsuario(dadosApi);

        const nomeCompleto = String(linha.NOME_COMPLETO ?? rand.nomeCompleto);
        const cpf = String(linha.CPF ?? rand.cpf);
        const idMassa = String(linha.ID_MASSA ?? 'C_0001');

        const record = {
            ID_MASSA: idMassa,
            NOME_COMPLETO: nomeCompleto,
            NOME_USUARIO: String(linha.NOME_USUARIO || buildNomeUsuario(nomeCompleto)),
            EMAIL: String(linha.EMAIL || buildEmail(nomeCompleto)),
            SENHA: String(linha.SENHA || SENHA_PADRAO_TESTES),
            CPF: cpf,
            TELEFONE: rand.telefone,
            CEP: rand.zipCode,
            RUA: rand.addressLine,
            NUMERO: rand.numeroEndereco,
            BAIRRO: rand.bairro,
            CIDADE: rand.city,
            ESTADO: rand.stateRegion,
            PAIS: rand.country,
            DATA_NASCIMENTO: rand.birthDate,
            BANDEIRA_CARTAO: rand.cardBrand,
            TIER_CARTAO: rand.cardTier,
            DIA_VENCIMENTO: rand.cardDueDay,
            NOME_IMPRESSO: nomeCompleto.toUpperCase(),
            PLANO_CONTA: rand.plan,
            CHAVE_PIX: cpf,
            NOME_TUTOR: rand.tutorName,
            CPF_TUTOR: rand.tutorCpf,
        };

        linhasCorrigidas.push(record);

        csvLines.push(
            [
                record.ID_MASSA, record.NOME_COMPLETO, record.NOME_USUARIO, record.EMAIL, record.SENHA, record.CPF,
                record.TELEFONE, record.CEP, record.RUA, record.NUMERO, record.BAIRRO, record.CIDADE, record.ESTADO,
                record.PAIS, record.DATA_NASCIMENTO, record.BANDEIRA_CARTAO, record.TIER_CARTAO, record.DIA_VENCIMENTO,
                record.NOME_IMPRESSO, record.PLANO_CONTA, record.CHAVE_PIX, record.NOME_TUTOR, record.CPF_TUTOR
            ]
                .map(formatCsvField)
                .join(';')
        );
    }

    linhasCorrigidas.forEach((l) => {
        console.log(`✅ Registro ${l.ID_MASSA} — ${l.NOME_COMPLETO} /${linhasCorrigidas.length} corrigido com dados randômicos.`);
    });

    const backup = `${caminhoAbsoluto}.bak-corrigirtblcadastro-${Date.now()}`;
    fs.copyFileSync(caminhoAbsoluto, backup);
    console.log(`ℹ️ Backup criado em: ${backup}`);

    workbook.Sheets[ABA] = XLSX.utils.json_to_sheet(linhasCorrigidas);
    XLSX.writeFile(workbook, caminhoAbsoluto);

    // XLSX.writeFile acima apagou a formatação de Tabela do Excel de TODAS as abas do
    // workbook (não só de ABA) — restaura as 3 abas padrão na sequência, nunca deixa o
    // arquivo num estado sem formatação.
    formatarTabelas(caminhoAbsoluto, [
        { nome: 'TBL_CENARIOS', tableId: 1, tableName: 'TabelaCenarios' },
        { nome: 'TBL_CADASTRO', tableId: 2, tableName: 'TabelaCadastro' },
        { nome: 'TBL_MASSA_CADASTRADA', tableId: 3, tableName: 'TabelaMassaCadastrada' },
    ]);

    // Também atualiza o CSV
    const csvPath = path.resolve(process.cwd(), 'data', 'massaCadastro.csv');
    fs.writeFileSync(csvPath, csvLines.join('\n') + '\n', 'utf-8');

    console.log(`🎉 Operação concluída. ${linhasCorrigidas.length} registro(s) randômicos gravados em: ${CAMINHO} (aba ${ABA}) e ${csvPath}`);
}

main().catch(console.error);
