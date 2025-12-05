// src/app/api/ping/route.ts
import { NextResponse } from 'next/server';

/**
 * 認証状態を維持するための軽量エンドポイント
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
