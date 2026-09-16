import winston from 'winston';

// Cria o formato de log personalizado
const customFormat = winston.format.printf(({ level, message, timestamp }) => {
    // Formata o nível para ficar alinhado (ex: 'INFO ' ou 'ERROR')
    const formattedLevel = level.toUpperCase().padEnd(5, ' ');
    return `${timestamp} ${formattedLevel} - ${message}`;
});

export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        // Utiliza o formato de data fornecido
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
    ),
    transports: [
        new winston.transports.Console()
    ],
});

/**
 * Formata uma duração em ms sempre com a unidade de minutos (nunca só segundos "soltos"),
 * igual ao "Time execution of test.........: 0 Hour(s) 3 minute(s) 5 second(s)" do
 * Hooks.java dos projetos mobile (Digio/Uber) — mais curto (sem palavras por extenso),
 * mas com o mesmo princípio: minuto sempre aparece, hora só quando relevante.
 */
export function formatarDuracao(ms: number): string {
    const totalSegundos = ms / 1000;
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = (totalSegundos % 60).toFixed(1);
    return horas > 0 ? `${horas}h ${minutos}min ${segundos}s` : `${minutos}min ${segundos}s`;
}

export default logger;
