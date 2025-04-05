const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.printf(({ level, message, ...metadata }) => {
            let msg = `${level}: ${message}`;
            if (metadata && Object.keys(metadata).length > 0) {
                // Handle objects and arrays
                if (typeof metadata === 'object') {
                    msg += `\n${JSON.stringify(metadata, null, 2)}`;
                } else {
                    msg += ` ${metadata}`;
                }
            }
            return msg;
        })
    ),
    transports: [
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),
        new winston.transports.File({ 
            filename: 'logs/combined.log',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

module.exports = logger; 