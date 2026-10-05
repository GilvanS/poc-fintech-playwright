import { writeFileSync } from 'node:fs';
import PizZip from 'pizzip';

// Planilha SINTÉTICA para os testes da atualização de massa: mesma anatomia do MassaDados.xlsx (aba tbl_de_massas formatada
// como Tabela, textos compartilhados, estilos nas células, calcChain, cabeçalho com espaço acidental, célula ausente),
// sem nenhum dado real. Os testes nunca tocam o MassaDados.xlsx de verdade.

export const CPF_ANA = '11111111111';
export const CPF_BETO = '22222222222';

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const celulaNumero = (ref: string, valor: number) => `<c r="${ref}" s="43"><v>${valor}</v></c>`;

/** `cpfAna` troca o CPF da primeira linha (o E2E usa o CPF de um cenário da semente). */
export function criarXlsxFalso(caminho: string, cpfAna = CPF_ANA): void {
  const TEXTOS = ['cpf', 'saldo_conta', 'limite_utilizado', 'limite_disponivel', ' fatura_fechada ', 'fatura_aberta', 'status_fatura_fechada', 'parcelas_a_vencer', 'nome', cpfAna, 'VIGENTE', 'Ana', CPF_BETO, 'PAGO_TOTAL', 'Beto'];
  const celulaTexto = (ref: string, texto: string, estilo = '') => `<c r="${ref}"${estilo} t="s"><v>${TEXTOS.indexOf(texto)}</v></c>`;
  const cabecalho = ['cpf', 'saldo_conta', 'limite_utilizado', 'limite_disponivel', ' fatura_fechada ', 'fatura_aberta', 'status_fatura_fechada', 'parcelas_a_vencer', 'nome']
    .map((t, i) => celulaTexto(`${'ABCDEFGHI'[i]}1`, t, ' s="11"'))
    .join('');
  // Ana: célula H (parcelas_a_vencer) AUSENTE na linha, para exercitar a inserção na posição certa.
  const ana =
    celulaTexto('A2', cpfAna) +
    celulaNumero('B2', 25000) +
    celulaNumero('C2', 721.27) +
    celulaNumero('D2', 14278.73) +
    celulaNumero('E2', 153.42) +
    celulaNumero('F2', 260.58) +
    celulaTexto('G2', 'VIGENTE', ' s="48"') +
    celulaTexto('I2', 'Ana');
  const beto =
    celulaTexto('A3', CPF_BETO) +
    celulaNumero('B3', 100) +
    celulaNumero('C3', 50) +
    celulaNumero('D3', 50) +
    celulaNumero('E3', 10) +
    celulaNumero('F3', 5) +
    celulaTexto('G3', 'PAGO_TOTAL', ' s="48"') +
    '<c r="H3" s="43"/>' +
    celulaTexto('I3', 'Beto');

  const zip = new PizZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/></Types>');
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${NS}><sheets><sheet name="OUTRA" sheetId="1" r:id="rId1"/><sheet name="tbl_de_massas" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029"/></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId9" Type="${REL}/calcChain" Target="calcChain.xml"/></Relationships>`);
  zip.file('xl/sharedStrings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${TEXTOS.length}" uniqueCount="${TEXTOS.length}">${TEXTOS.map((t) => `<si><t xml:space="preserve">${t}</t></si>`).join('')}</sst>`);
  zip.file('xl/calcChain.xml', '<calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><c r="A1" i="1"/></calcChain>');
  zip.file('xl/worksheets/sheet1.xml', `<worksheet ${NS}><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>intocável</t></is></c></row></sheetData></worksheet>`);
  zip.file(
    'xl/worksheets/sheet2.xml',
    `<worksheet ${NS}><dimension ref="A1:I3"/><sheetData><row r="1" spans="1:9">${cabecalho}</row><row r="2" spans="1:9">${ana}</row><row r="3" spans="1:9">${beto}</row></sheetData><tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>`,
  );
  zip.file('xl/worksheets/_rels/sheet2.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/table" Target="../tables/table1.xml"/></Relationships>`);
  zip.file('xl/tables/table1.xml', `<table ${NS} id="1" name="tbl_de_massas" displayName="tbl_de_massas" ref="A1:I3"><autoFilter ref="A1:I3"/></table>`);
  writeFileSync(caminho, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
}

/** Os valores que o FintechBankApp devolveria para a Ana depois de um pagamento mínimo. */
export const FONTE_ANA: Record<string, string> = {
  cpf: CPF_ANA,
  saldo_conta: '24615,07',
  limite_utilizado: '1157,26',
  limite_disponivel: '13842,74',
  fatura_fechada: '999,99', // a fonte diverge, mas fatura_fechada nunca é gravada
  fatura_aberta: '194,19',
  status_fatura_fechada: 'PAGO_PARCIAL',
  parcelas_a_vencer: '898,17',
};
