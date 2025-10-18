import pino from 'pino';

// Create a more robust logger configuration that handles worker thread issues
const createLogger = () => {
	const baseConfig = {
		level: process.env.LOG_LEVEL || 'info',
	};

	// In development, use a simpler configuration to avoid worker thread issues
	if (process.env.NODE_ENV !== 'production') {
		// Use a basic logger without transport to avoid worker thread issues
		return pino({
			...baseConfig,
			// Remove transport to avoid worker thread issues
			// The basic pino logger will output JSON which is still readable
		});
	}

	return pino(baseConfig);
};

export const serverLogger = createLogger();

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