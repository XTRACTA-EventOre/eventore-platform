import 'dotenv/config';

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid port number');
}

export const environment = Object.freeze({
    port
});