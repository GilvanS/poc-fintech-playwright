import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import fs from 'fs';
import path from 'path';
import { Page } from '@playwright/test';
import { logger } from './logger';

export interface EvidenceData {
    feature: string;
    scenario: string;
    status: string;
    inicio: string;
    fim: string;
    data: string;
    requestMethod?: string;
    requestUri?: string;
    headers?: string;
    requestBody?: string;
    statusCode?: string;
    responseBody?: string;
    idExecucao?: string;
    massaDeTeste?: string;
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
            logger.info(`📸 Capturado print: "${title}" -> ${filePath}`);
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

            // Status colorido no docx: só uma das 4 seções condicionais
            // (isPassed/isFailed/isNA/isOther) renderiza, cada uma com sua cor.
            const statusNormalizado = (data.status || '').trim().toUpperCase();
            const isPassed = statusNormalizado === 'PASSED';
            const isFailed = statusNormalizado === 'FAILED';
            const isNA = statusNormalizado === 'N/A' || statusNormalizado === 'NA';
            const isOther = !isPassed && !isFailed && !isNA;

            const templateData = {
                projeto: this.projeto,
                data: data.data,
                feature: data.feature,
                scenario: data.scenario,
                inicio: data.inicio,
                fim: data.fim,
                status: data.status,
                isPassed,
                isFailed,
                isNA,
                isOther,
                requestMethod: data.requestMethod || 'WEB',
                idExecucao: data.idExecucao || this.currentIdExecucao || `EXEC_${Date.now()}`,
                massaDeTeste: data.massaDeTeste || this.currentMassaDeTeste,
                screenshots: this.screenshots.map(s => ({
                    title: s.title,
                    image: s.imagePath
                }))
            };

            doc.render(templateData);

            const buf = doc.getZip().generate({
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

