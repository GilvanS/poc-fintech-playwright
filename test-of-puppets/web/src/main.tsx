import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// A ferramenta é só dark. O fundo animado (copiado do Admin) lê esta classe para escolher os cinzas escuros.
document.body.classList.add('theme-midnight');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
