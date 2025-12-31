// src/app/api/heartbeat/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
    try {
        // heartbeatテーブルに現在時刻を記録
        const { error } = await supabase
            .from('heartbeat')
            .upsert(
                { id: 1, last_ping: new Date().toISOString() },
                { onConflict: 'id' }
            );

        if (error) {
            console.error('Heartbeat error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Heartbeat recorded',
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Heartbeat failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
