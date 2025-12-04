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
    // imageBase64: Base64文字列 (data:image/...;base64, 部分は除く)
    const { text, imageUrl, imageBase64, mimeType: reqMimeType, model: modelName, customPrompt } = await req.json();

    if (!text && !imageUrl && !imageBase64) {
      return NextResponse.json({ error: '問題文または画像が必要です' }, { status: 400 });
    }

    // 指定されたモデルを使用 (デフォルトは gemini-2.5-pro)
    const targetModel = modelName || "gemini-2.5-pro";
    const model = genAI.getGenerativeModel({ model: targetModel });

    // デフォルトプロンプト（データベース設定が取得できない場合の予備）
    const defaultPrompt = `入力された問題を解いて、正解を出力してください。

問題文の最後に[提供された正解]が記載されている場合は、その正解が問題の正解と一致するかも検証してください。

【正解】
(答えのみ記述)

[提供された正解]がある場合：
【正解の検証】
(提供された正解が正しいかを記述)`;

    const prompt = customPrompt || defaultPrompt;

    const contentParts: any[] = [prompt];

    if (text) {
      contentParts.push(`\n\n---\n■検証対象データ\n\n【問題文】\n${text}`);
    }

    // Base64データが直接渡された場合
    if (imageBase64) {
      contentParts.push({
        inlineData: {
          data: imageBase64,
          mimeType: reqMimeType || 'image/jpeg'
        }
      });
    }
    // URLが渡された場合 (Supabase等)
    else if (imageUrl) {
      try {
        const imageResp = await fetch(imageUrl);
        const arrayBuffer = await imageResp.arrayBuffer();
        const base64Image = Buffer.from(arrayBuffer).toString('base64');
        
        // MIMEタイプの判定を強化
        let mimeType = imageResp.headers.get('content-type');
        if (!mimeType || mimeType === 'application/octet-stream') {
          // ヘッダーから判別できない場合は拡張子で判断
          if (imageUrl.toLowerCase().includes('.pdf')) {
            mimeType = 'application/pdf';
          } else {
            mimeType = 'image/jpeg'; // デフォルト
          }
        }

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

    // リトライロジック (最大2回)
    let retries = 0;
    const maxRetries = 2;
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
        
        // 429 (レート制限) または quota exceeded エラーの場合は即座に失敗
        const is429Error = e.message?.includes('429') || 
                          e.message?.includes('Quota exceeded') || 
                          e.message?.includes('quota');
        
        if (is429Error) {
          answer = "（エラー: API制限超過。Gemini 2.5 Proは1分2回/1日50回まで。時間をおいて再試行するか、Gemini 2.5 Flashをご利用ください）";
          break; // リトライせずに即座に終了
        }
        
        if (retries === maxRetries) {
          // 最終試行でも失敗した場合
          if (e.message?.includes('503')) {
            answer = "（エラー: サーバー混雑中。再試行してください）";
          } else {
            answer = `（AI生成エラー: ${e.message || '不明'}）`;
          }
        } else {
          // リトライ待機 (指数バックオフ: 2s, 4s...)
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