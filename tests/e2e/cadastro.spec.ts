import { test } from '../../fixtures/testFixture';
import { createNewUser } from '../utils/faker-helper';

test.describe('CT00 - User Registration and Login', () => {
    test('should allow a new user to register, login, and validate profile name', async ({ cadastroFlow, authFlow }) => {
        const newUser = createNewUser('fr');

        // 1. Executa o fluxo completo de cadastro reutilizável com cadastroFlow
        await cadastroFlow.realizarCadastroCompleto(
            newUser.fullName,
            newUser.email,
            newUser.cpf,
            newUser.password
        );

        // 2. Realiza o login com os dados do novo usuário via authFlow
        await authFlow.login(newUser.cpf, newUser.password);
    });
});
