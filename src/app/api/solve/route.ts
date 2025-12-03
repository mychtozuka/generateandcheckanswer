// src/app/api/solve/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';

// Vercelのタイムアウト対策
export const maxDuration = 60; 

export async function POST(req: Request) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    // 単一の問題を受け取る形に変更
    const { text, imageUrl, model: modelName, customPrompt } = await req.json();

    if (!text && !imageUrl) {
      return NextResponse.json({ error: '問題文または画像が必要です' }, { status: 400 });
    }

    // 指定されたモデルを使用 (デフォルトは gemini-2.5-pro)
    const targetModel = modelName || "gemini-2.5-pro";
    const model = genAI.getGenerativeModel({ model: targetModel });

    // プロンプト (校正機能付き・併記可能)
    const defaultPrompt = `あなたはプロの学習塾講師および教材校正者です。
入力された問題を解く前に、問題文や図表に不備（矛盾、情報不足、誤字脱字、解答不能な設定など）がないか厳密にチェックしてください。

以下のフォーマットに従って出力してください。

もし問題に不備や改善点がある場合：
【指摘事項】
(具体的な問題点と修正案)

解答が可能な場合（不備があっても推測可能なら含む）：
【正解】
(明確な答えのみ記述すること。解説は不要です。)

※不備があっても解答できる場合は、【指摘事項】と【正解】の両方を出力してください。
※解答不能なほど致命的な不備がある場合は、【指摘事項】のみを出力してください。`;

    const prompt = customPrompt || defaultPrompt;

    const contentParts: any[] = [prompt];

    if (text) {
      contentParts.push(`\n\n[問題文]: ${text}`);
    }

    if (imageUrl) {
      try {
        const imageResp = await fetch(imageUrl);
        const arrayBuffer = await imageResp.arrayBuffer();
        const base64Image = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = imageResp.headers.get('content-type') || 'image/jpeg';

        contentParts.push({
          inlineData: {
            data: base64Image,
            mimeType: mimeType
          }
        });
      } catch (e) {
        console.error("Image fetch error:", e);
        return NextResponse.json({ answer: "（画像の読み込みに失敗しました）" });
      }
    }

    // リトライロジック (最大3回)
    let retries = 0;
    const maxRetries = 3;
    let answer = "";

    while (retries <= maxRetries) {
      try {
        // AI実行
        const result = await model.generateContent(contentParts);
        answer = result.response.text();

        // 履歴保存 (非同期で待たない)
        supabase
          .from('questions')
          .insert([{ question_text: text, image_url: imageUrl, ai_answer: answer }])
          .then(({ error }) => {
            if (error) console.error('DB Save Error:', error);
          });

        // 成功したらループを抜ける
        break;

      } catch (e: any) {
        console.error(`AI generation error (Attempt ${retries + 1}):`, e.message);
        
        if (retries === maxRetries) {
          // 最終試行でも失敗した場合
          if (e.message?.includes('429')) {
            answer = "（エラー: リクエスト制限超過。時間を置いて再試行してください）";
          } else if (e.message?.includes('503')) {
            answer = "（エラー: サーバー混雑中。再試行してください）";
          } else {
            answer = `（AI生成エラー: ${e.message || '不明'}）`;
          }
        } else {
          // リトライ待機 (指数バックオフ: 2s, 4s, 8s...)
          const waitTime = 2000 * Math.pow(2, retries);
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries++;
        }
      }
    }

    return NextResponse.json({ answer });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: `Internal Server Error: ${error.message || 'Unknown error'}` }, { status: 500 });
  }
}