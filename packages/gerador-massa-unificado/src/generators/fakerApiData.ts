import { fakerPT_BR as faker } from '@faker-js/faker';

export interface DadosFaker {
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  password: string | null;
  fullName: string | null;
  addressLine: string | null;
  buildingNumber: string | null;
  city: string | null;
  stateRegion: string | null;
  zipCode: string | null;
  country: string | null;
  neighborhood: string | null;
  birthDate: string | null;
  cardNumber: string | null;
  cardFullName: string | null;
  expiryDate: string | null;
  cvv: string;
  articleTitle: string | null;
  articleContent: string;
}

let offlineMode = true;

export function habilitarModoOffline(): void {
  offlineMode = true;
}

export function __resetOfflineModeParaTestes(): void {
  offlineMode = true;
}

export function definirSeed(seed: number): void {
  faker.seed(seed);
}

export async function gerarDados(): Promise<DadosFaker> {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const fullName = `${firstName} ${lastName}`;

  return {
    firstName,
    lastName,
    fullName,
    phoneNumber: faker.phone.number({ style: 'human' }),
    password: `Senha${faker.internet.password({ length: 8, pattern: /[a-zA-Z0-9]/ })}!`,
    addressLine: faker.location.street(),
    buildingNumber: faker.location.buildingNumber(),
    city: faker.location.city(),
    stateRegion: faker.location.state({ abbreviated: true }),
    zipCode: faker.location.zipCode('#####-###'),
    country: 'Brasil',
    neighborhood: faker.location.county() || 'Centro',
    birthDate: faker.date.birthdate({ min: 18, max: 60, mode: 'age' }).toISOString().split('T')[0],
    cardNumber: faker.finance.creditCardNumber({ issuer: 'visa' }),
    cardFullName: fullName,
    expiryDate: `${String(faker.number.int({ min: 1, max: 12 })).padStart(2, '0')}/${faker.number.int({ min: 26, max: 35 })}`,
    cvv: faker.finance.creditCardCVV(),
    articleTitle: null,
    articleContent: '',
  };
}