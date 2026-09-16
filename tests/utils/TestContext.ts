import { getCenarioData, ScenarioData } from './excelReader';
import { LoginModel } from '../massa-types/LoginModel';

export class TestContext {
    private static currentScenarioData: ScenarioData | null = null;
    private static currentLoginModel: LoginModel | null = null;

    /**
     * Extrai a tag de ID do cenário do título do teste (ex: 'CT01.2' de 'CT01.2 - Fazer login como Admin')
     * e carrega os dados da planilha Excel no contexto.
     */
    static loadFromTestTitle(testTitle: string): ScenarioData | null {
        // Expressão regular para capturar padrões como: CT01.2, CT01.1, CT-1008, cadastrar
        const match = testTitle.match(/(CT\d+(\.\d+)?|CT-\d+|cadastrar)/i);
        const scenarioId = match ? match[0] : null;

        if (!scenarioId) {
            this.clearContext();
            return null;
        }

        try {
            const scenario = getCenarioData(scenarioId);
            this.currentScenarioData = scenario;

            // Monta o LoginModel com base na linha encontrada em TBL_CENARIOS
            this.currentLoginModel = {
                cpf: String(scenario.CPF || ''),
                senha: String(scenario.SENHA || ''),
                email: scenario.EMAIL ? String(scenario.EMAIL) : undefined,
                idUsuario: scenario.ID_MASSA ? String(scenario.ID_MASSA) : undefined
            };

            return scenario;
        } catch (error) {
            console.warn(`[TestContext] Não foi possível carregar massa automática para o título: "${testTitle}". ${error}`);
            this.clearContext();
            return null;
        }
    }

    /**
     * Retorna os dados do LoginModel do contexto atual.
     * Caso não haja massa no contexto, lança um aviso ou retorna um objeto padrão.
     */
    static getLoginModel(): LoginModel {
        if (this.currentLoginModel) {
            return this.currentLoginModel;
        }
        console.warn('[TestContext] Nenhuma massa de login encontrada para o cenário atual. Usando credencial de fallback fixa — verifique se o título do teste segue o padrão CTxx.x ou se o CPF existe em TBL_CENARIOS.');
        return {
            cpf: '11111111111',
            senha: 'admin999'
        };
    }

    /**
     * Retorna os dados crus do cenário carregados do Excel.
     */
    static getScenarioData(): ScenarioData | null {
        return this.currentScenarioData;
    }

    /**
     * Limpa o contexto de testes.
     */
    static clearContext(): void {
        this.currentScenarioData = null;
        this.currentLoginModel = null;
    }
}
