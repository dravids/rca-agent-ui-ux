import { NextResponse } from 'next/server';
import { serverLogger } from '@/lib/logger';

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { level = 'info', message, context } = body || {};
		const log = serverLogger.child({ source: 'client' });
		(log as any)[level]?.({ context }, message) ?? log.info({ context }, message);
		return NextResponse.json({ ok: true });
	} catch (error) {
		serverLogger.error({ err: error }, 'Failed to ingest client log');
		return NextResponse.json({ ok: false }, { status: 400 });
	}
} 