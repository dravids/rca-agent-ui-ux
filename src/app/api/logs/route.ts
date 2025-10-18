import { NextResponse } from 'next/server';
import { serverLogger } from '@/lib/logger';

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { level = 'info', message, context } = body || {};
		const log = serverLogger.child({ source: 'client' });
		
		// Safely call the appropriate log level method
		if (typeof log[level] === 'function') {
			log[level]({ context }, message);
		} else {
			log.info({ context }, message);
		}
		
		return NextResponse.json({ ok: true });
	} catch (error) {
		// Use console.error as fallback to avoid potential logger issues
		console.error('Failed to ingest client log:', error);
		try {
			serverLogger.error({ err: error }, 'Failed to ingest client log');
		} catch (loggerError) {
			console.error('Logger also failed:', loggerError);
		}
		return NextResponse.json({ ok: false }, { status: 400 });
	}
} 