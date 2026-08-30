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

export default logger;
