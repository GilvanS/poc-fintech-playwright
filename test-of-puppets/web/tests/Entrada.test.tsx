import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Entrada from '../src/pages/Entrada';
import { IMAGENS_ENTRADA } from '../src/pages/entrada/imagens';

describe('Tela de entrada', () => {
  it('mostra o título, o botão Entrar e nenhum campo de senha', () => {
    render(<Entrada onEntrar={() => {}} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Test of Puppets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it('Entrar avisa o app', async () => {
    const onEntrar = vi.fn();
    render(<Entrada onEntrar={onEntrar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(onEntrar).toHaveBeenCalledTimes(1);
  });

  it('as imagens vêm de um único arquivo de configuração, cada uma com src e texto alternativo', () => {
    expect(IMAGENS_ENTRADA.length).toBeGreaterThanOrEqual(4);
    for (const imagem of IMAGENS_ENTRADA) {
      expect(typeof imagem.src).toBe('string');
      expect(imagem.src.length).toBeGreaterThan(0);
      expect(imagem.alt.length).toBeGreaterThan(0);
    }
  });

  it('mostra uma foto para cada imagem configurada', () => {
    render(<Entrada onEntrar={() => {}} />);
    expect(screen.getAllByRole('img')).toHaveLength(IMAGENS_ENTRADA.length);
  });

  it('aceita uma lista própria de imagens', () => {
    const outras = [
      { src: '/entrada/a.jpg', alt: 'Foto A' },
      { src: '/entrada/b.jpg', alt: 'Foto B' },
    ];
    render(<Entrada onEntrar={() => {}} imagens={outras} />);
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByAltText('Foto A')).toHaveAttribute('src', '/entrada/a.jpg');
  });

  it('sem canvas (como no jsdom) a galeria não quebra e as fotos continuam visíveis', () => {
    render(<Entrada onEntrar={() => {}} />);
    expect(screen.queryByTestId('ascii')).toBeNull();
    for (const foto of screen.getAllByRole('img')) expect(foto).toBeVisible();
  });

  it('foto que não carrega não deixa buraco: mostra o texto alternativo no lugar', () => {
    render(<Entrada onEntrar={() => {}} imagens={[{ src: '/entrada/quebrada.jpg', alt: 'Foto quebrada' }]} />);
    fireEvent.error(screen.getByAltText('Foto quebrada'));
    expect(screen.getByText('Foto quebrada')).toBeInTheDocument();
  });
});
