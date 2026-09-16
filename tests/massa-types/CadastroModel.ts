export interface CadastroModel {
    seq?: string | number;
    idMassa?: string;
    nomeCompleto: string;
    nomeUsuario?: string;
    email: string;
    senha: string;
    cpf: string;
    telefone?: string;
    cep?: string;
    rua?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    pais?: string;
    dataNascimento?: string;
    bandeiraCartao?: string;
    tierCartao?: string;
    diaVencimento?: number | string;
    nomeImpresso?: string;
    planoConta?: string;
    chavePix?: string;
    nomeTutor?: string;
    cpfTutor?: string;
    idUsuario?: string;
}
