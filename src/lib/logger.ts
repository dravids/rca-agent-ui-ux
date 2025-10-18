import pino from 'pino';

export const serverLogger = pino({
	level: process.env.LOG_LEVEL || 'info',
	transport: process.env.NODE_ENV !== 'production' ? {
		target: 'pino-pretty',
		options: { colorize: true }
	} : undefined
});

export type ClientLogPayload = {
	level?: 'debug' | 'info' | 'warn' | 'error';
	message: string;
	context?: Record<string, unknown>;
};

export async function clientLog(payload: ClientLogPayload) {
	try {
		// Fire-and-forget client log to server
		await fetch('/api/logs', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
	} catch {
		// no-op on client
	}
} 