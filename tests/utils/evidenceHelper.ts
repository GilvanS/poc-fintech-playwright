import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import fs from 'fs';
import path from 'path';
import { Page } from '@playwright/test';
import { attachmentPath, ContentType } from 'allure-js-commons';
import { logger } from './logger';

// docxtemplater-image-module-free não publica tipos próprios nem tem pacote @types/ —
// sem isso o import acima quebra a compilação.
declare module 'docxtemplater-image-module-free';

export interface EvidenceData {
    feature: string;
    scenario: string;
    status: string;
    inicio: string;
    fim: string;
    data: string;
    navegador?: string;
    requestUri?: string;
    headers?: string;
    requestBody?: string;
    statusCode?: string;
    responseBody?: string;
    idExecucao?: string;
    massaDeTeste?: string;
}

const STATUS_COLORS: Record<'PASSED' | 'FAILED' | 'NA' | 'OTHER', string> = {
    PASSED: '008000',
    FAILED: 'C00000',
    NA: '808080',
    OTHER: 'ED7D31',
};

function corDoStatus(status: string): string {
    const normalizado = (status || '').trim().toUpperCase();
    if (normalizado === 'PASSED') return STATUS_COLORS.PASSED;
    if (normalizado === 'FAILED') return STATUS_COLORS.FAILED;
    if (normalizado === 'N/A' || normalizado === 'NA') return STATUS_COLORS.NA;
    return STATUS_COLORS.OTHER;
}

function escapeXml(text: string): string {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export interface ScreenshotStep {
    title: string;
    imagePath: string;
}

export class EvidenceHelper {
    private static readonly templatePath = path.resolve(__dirname, '../../data/Evidencia Modelo WEB.docx');
    private static readonly outputDir = path.resolve(__dirname, '../../evidences');
    private static readonly tempDir = path.resolve(__dirname, '../../evidences/temp');
    private static readonly projeto = 'FintechBankApp - WEB';

    private static screenshots: ScreenshotStep[] = [];
    private static currentMassaDeTeste: string = 'N/A';
    private static currentIdExecucao: string = '';

    static clearScreenshots(): void {
        this.screenshots = [];
        this.currentMassaDeTeste = 'N/A';
        this.currentIdExecucao = `EXEC_${Date.now()}`;
    }

    static setMassaDeTeste(massa: string): void {
        this.currentMassaDeTeste = massa;
    }

    static setIdExecucao(id: string): void {
        this.currentIdExecucao = id;
    }

    static async captureStep(page: Page, title: string): Promise<void> {
        try {
            if (!fs.existsSync(this.tempDir)) {
                fs.mkdirSync(this.tempDir, { recursive: true });
            }
            const fileName = `step_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
            const filePath = path.join(this.tempDir, fileName);
            await page.screenshot({ path: filePath, fullPage: true });
            this.screenshots.push({ title, imagePath: filePath });

            // Mesma screenshot que alimenta o DOCX também vira anexo do step atual no
            // Allure — try/catch separado: falha de attachment do Allure (ex: reporter
            // não ativo nessa run) nunca pode derrubar a captura de evidência do DOCX.
            try {
                await attachmentPath(title, filePath, ContentType.PNG);
            } catch (allureError) {
                logger.error(`⚠️ Erro ao anexar screenshot "${title}" no Allure: ${allureError}`);
            }
        } catch (error) {
            logger.error(`⚠️ Erro ao capturar screenshot para "${title}": ${error}`);
        }
    }

    static async generateEvidence(data: EvidenceData, testTitle: string): Promise<void> {
        try {
            if (!fs.existsSync(this.outputDir)) {
                fs.mkdirSync(this.outputDir, { recursive: true });
            }

            const content = fs.readFileSync(this.templatePath, 'binary');
            const zip = new PizZip(content);

            const imageModule = new ImageModule({
                centered: true,
                getImage: (tagValue: string) => fs.readFileSync(tagValue),
                getSize: () => [550, 310]
            });

            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                delimiters: { start: '{{', end: '}}' },
                modules: [imageModule]
            });

            const templateData = {
                projeto: this.projeto,
                data: data.data,
                feature: data.feature,
                scenario: data.scenario,
                inicio: data.inicio,
                fim: data.fim,
                status: data.status,
                navegador: data.navegador || 'N/A',
                idExecucao: data.idExecucao || this.currentIdExecucao || `EXEC_${Date.now()}`,
                massaDeTeste: data.massaDeTeste || this.currentMassaDeTeste,
                screenshots: this.screenshots.map(s => ({
                    title: s.title,
                    image: s.imagePath
                }))
            };

            doc.render(templateData);

            // Colore o valor de Status no XML já renderizado (template mantém
            // apenas {{status}} limpo — a cor é aplicada aqui, não no template).
            const renderedZip = doc.getZip();
            const documentXml = renderedZip.file('word/document.xml')!.asText();
            const statusRun = `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:i/><w:iCs/></w:rPr><w:t xml:space="preserve">${escapeXml(data.status)}</w:t></w:r>`;
            const statusRunColorido = `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:i/><w:iCs/><w:color w:val="${corDoStatus(data.status)}"/></w:rPr><w:t xml:space="preserve">${escapeXml(data.status)}</w:t></w:r>`;
            if (documentXml.includes(statusRun)) {
                renderedZip.file('word/document.xml', documentXml.replace(statusRun, statusRunColorido));
            } else {
                logger.error('⚠️ Não encontrou o run de Status no docx renderizado — cor não aplicada.');
            }

            const buf = renderedZip.generate({
                type: 'nodebuffer',
                compression: 'DEFLATE',
            });

            const safeTitle = testTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const timestamp = new Date().getTime();
            const outputPath = path.resolve(this.outputDir, `${safeTitle}_${timestamp}.docx`);

            fs.writeFileSync(outputPath, buf);
            logger.info(`📄 Evidência DOCX gerada com sucesso: ${outputPath}`);

            // Limpa os arquivos temporários de imagem
            this.screenshots.forEach(s => {
                if (fs.existsSync(s.imagePath)) {
                    try { fs.unlinkSync(s.imagePath); } catch {}
                }
            });
            this.clearScreenshots();
        } catch (error) {
            logger.error(`⚠️ Falha ao gerar evidência DOCX: ${error}`);
        }
    }
}

