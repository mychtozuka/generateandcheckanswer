// src/app/api/settings/generate-prompt/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// DB上のキー名を定義（チェックツール用の 'system_prompt' と区別する）
const SETTING_KEY = 'generate_system_prompt';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', SETTING_KEY) // キーを変更
      .single();

    if (error) {
      // データがない場合（初回など）はnullを返してデフォルトを使わせる
      // PGRST116 は "The result contains 0 rows" のエラーコード
      if (error.code !== 'PGRST116') {
        console.error('Error fetching prompt:', error);
      }
      return NextResponse.json({ prompt: null });
    }

    return NextResponse.json({ prompt: data?.value });
  } catch (error) {
    console.error('Internal Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('system_settings')
      .upsert({ 
        key: SETTING_KEY, // キーを変更
        value: prompt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) {
      console.error('Error updating prompt:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Internal Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}