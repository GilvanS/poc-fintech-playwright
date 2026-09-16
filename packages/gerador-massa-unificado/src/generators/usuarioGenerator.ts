import { removerAcentos, limparParaNomeSimples } from '../utils/stringUtils';
import { gerarCpf, gerarCnpj, gerarCep } from './documentosGenerator';
import { gerarSenhaCustomizada } from './passwordGenerator';
import type { DadosFaker } from './fakerApiData';

export interface Usuario {
  nome: string;
  sobrenome: string;
  nomeCompleto: string;
  nomeUsuario: string;
  email: string;
  senha: string;
  administrador: boolean;
  cpf: string;
  telefone: string;
  razaoSocial: string;
  cnpj: string;
  addressLine: string;
  numeroEndereco: string;
  city: string;
  stateRegion: string;
  zipCode: string;
  country: string;
  bairro: string;
  birthDate: string;
  cardBrand: string;
  cardTier: string;
  cardDueDay: number;
  cardPrintedName: string;
  plan: string;
  pixKey: string;
  tutorName: string;
  tutorCpf: string;
  cardNumber: string;
  expiryDate: string;
}

const DOMINIOS_EMAIL = [
  '@gmail.com', '@yahoo.com', '@outlook.com', '@hotmail.com', '@icloud.com',
  '@aol.com', '@protonmail.com', '@zoho.com', '@yandex.com', '@gmx.com',
  '@mail.com', '@live.com', '@msn.com', '@me.com', '@uol.com.br',
  '@bol.com.br', '@terra.com.br', '@ig.com.br', '@inbox.com', '@fastmail.com',
];

function normalizeString(input: string | null | undefined): string {
  if (!input || !input.trim()) return '';
  const semAcentos = removerAcentos(input.toLowerCase()) ?? '';
  return semAcentos.replace(/[^a-z0-9]/g, '');
}

export function gerarUsuario(dadosApi: DadosFaker): Usuario {
  let firstName = dadosApi.firstName;
  let lastName = dadosApi.lastName;

  if (!firstName || !firstName.trim()) firstName = 'Usuario';
  if (!lastName || !lastName.trim()) lastName = `Convidado${Math.floor(Math.random() * 1000)}`;

  const nomeCompleto = `${firstName} ${lastName}`;
  const nomeLimpo = limparParaNomeSimples(firstName) as string;
  const sobrenomeLimpo = limparParaNomeSimples(lastName) as string;
  const nomeCompletoLimpo = limparParaNomeSimples(nomeCompleto) as string;

  const nomeUsuario = `${normalizeString(firstName)}.${normalizeString(lastName)}`;
  const dominio = DOMINIOS_EMAIL[Math.floor(Math.random() * DOMINIOS_EMAIL.length)];
  const email = `${normalizeString(lastName)}.${normalizeString(firstName)}${dominio}`;

  const cpf = gerarCpf(false);
  const cnpj = gerarCnpj(false);
  const razaoSocial = `${nomeCompletoLimpo} LTDA`;
  const senha = gerarSenhaCustomizada(nomeCompletoLimpo, cpf);

  const brandOptions = ['MASTERCARD', 'VISA', 'ELO', 'AMEX', 'HIPERCARD'];
  const tierOptions = ['BRONZE', 'GOLD', 'PLATINUM', 'BLACK'];
  const dueDayOptions = [10, 15, 20, 25];
  const planOptions = ['FREE', 'PRO', 'VIP_BLACK'];

  const cardBrand = brandOptions[Math.floor(Math.random() * brandOptions.length)];
  const cardTier = tierOptions[Math.floor(Math.random() * tierOptions.length)];
  const cardDueDay = dueDayOptions[Math.floor(Math.random() * dueDayOptions.length)];
  const plan = planOptions[Math.floor(Math.random() * planOptions.length)];

  return {
    nome: nomeLimpo,
    sobrenome: sobrenomeLimpo,
    nomeCompleto: nomeCompletoLimpo,
    nomeUsuario,
    email,
    senha,
    administrador: true,
    cpf,
    telefone: dadosApi.phoneNumber ? dadosApi.phoneNumber.replace(/\D/g, '') : '',
    razaoSocial,
    cnpj,
    addressLine: dadosApi.addressLine ? (removerAcentos(dadosApi.addressLine) as string) : 'Rua das Flores',
    numeroEndereco: dadosApi.buildingNumber ?? '100',
    city: dadosApi.city ? (removerAcentos(dadosApi.city) as string) : 'Sao Paulo',
    stateRegion: dadosApi.stateRegion ? (removerAcentos(dadosApi.stateRegion) as string) : 'SP',
    zipCode: gerarCep(false),
    country: dadosApi.country ? (removerAcentos(dadosApi.country) as string) : 'Brasil',
    bairro: dadosApi.neighborhood ? (removerAcentos(dadosApi.neighborhood) as string) : 'Centro',
    birthDate: dadosApi.birthDate ?? '2000-01-01',
    cardBrand,
    cardTier,
    cardDueDay,
    cardPrintedName: nomeCompletoLimpo.toUpperCase(),
    plan,
    pixKey: cpf,
    tutorName: '',
    tutorCpf: '',
    cardNumber: dadosApi.cardNumber ?? '',
    expiryDate: dadosApi.expiryDate ?? '',
  };
}
