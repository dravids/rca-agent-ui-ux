import { NextResponse } from 'next/server';
import { generateLargeTree } from '@/lib/rcaData';
import { serverLogger } from '@/lib/logger';

export async function GET() {
	serverLogger.info({ route: '/api/rca' }, 'RCA data requested');
	const data = generateLargeTree();
	return NextResponse.json({ data });
} 