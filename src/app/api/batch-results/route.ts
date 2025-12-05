// src/app/api/batch-results/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    const { result } = await req.json();

    if (!result) {
      return NextResponse.json({ error: 'result is required' }, { status: 400 });
    }

    // batch_check_resultsテーブルに保存
    const { data, error } = await supabase
      .from('batch_check_results')
      .insert([{
        problem_key: result.key,
        grade: result.csvData['学年'],
        subject: result.csvData['教科'],
        section: result.csvData['節'],
        unit: result.csvData['単元'],
        difficulty: result.csvData['難易度'],
        check_number: result.csvData['チェックナンバー'],
        test_number: result.csvData['テストナンバー'],
        file_name: result.fileName,
        question_text: result.csvData['問題文'],
        correct_answer_1: result.csvData['正解1'],
        correct_answer_2: result.csvData['正解2'],
        correct_answer_3: result.csvData['正解3'],
        correct_answer_4: result.csvData['正解4'],
        correct_answer_5: result.csvData['正解5'],
        ai_answer: result.answer,
        has_issue: result.hasIssue,
        status: result.status,
        checked_at: new Date().toISOString()
      }]);

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
