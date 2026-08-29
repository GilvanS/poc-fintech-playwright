import { faker, Faker, pt_BR, de, en_US, fr, es } from '@faker-js/faker';

// --- Funções de Utilidade ---

function generateValidCPF() {
    const rnd = (n: number) => Math.round(Math.random() * n);
    const mod = (a: number, b: number) => Math.round(a - Math.floor(a / b) * b);

    const n = Array(9).fill(0).map(() => rnd(9));
    
    let d1 = n.map((val, i) => val * (10 - i)).reduce((acc, val) => acc + val, 0);
    d1 = 11 - mod(d1, 11);
    if (d1 >= 10) d1 = 0;

    let d2 = n.map((val, i) => val * (11 - i)).reduce((acc, val) => acc + val, 0) + d1 * 2;
    d2 = 11 - mod(d2, 11);
    if (d2 >= 10) d2 = 0;

    const cpf = `${n.join('')}${d1}${d2}`;
    // Formata o CPF para xxx.xxx.xxx-xx
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}


// --- Geração de Dados Falsos ---

const fakers = {
    'pt_BR': new Faker({ locale: [pt_BR] }),
    'de': new Faker({ locale: [de] }),
    'en_US': new Faker({ locale: [en_US] }),
    'fr': new Faker({ locale: [fr] }),
    'es': new Faker({ locale: [es] })
};

/**
 * Gera um novo usuário com dados falsos, permitindo a especificação de um locale.
 * @param localeKey - A chave do locale. Chaves disponíveis: 'pt_BR', 'de', 'en_US', 'fr', 'es'.
 *                    Usa 'pt_BR' como padrão.
 */
export function createNewUser(localeKey: keyof typeof fakers = 'es') {
    
    const fakerInstance = fakers[localeKey];
    
    const firstName = fakerInstance.person.firstName();
    const lastName = fakerInstance.person.lastName();
    const fullName = `${firstName} ${lastName}`;

    const newUser = {
        fullName: fullName,
        email: fakerInstance.internet.email({ firstName, lastName }),
        cpf: generateValidCPF(),
        password: 'admin999'
    };

    console.log(`--- New User Created (Locale: ${localeKey}) ---`);
    console.log(newUser);

    return newUser;
}
