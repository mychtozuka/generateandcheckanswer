import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { imageUrl, questionCount, model, customPrompt } = await req.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    // 環境変数はプロジェクトで異なる名前を使っている可能性があるため、フォールバックを許可する
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('Missing API key. Checked GOOGLE_GENERATIVE_AI_API_KEY, GEMINI_API_KEY, GOOGLE_API_KEY');
      return NextResponse.json(
        { error: "API Key not configured. Set GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY." },
        { status: 500 }
      );
    }

    // 1. 画像を取得してBase64化
    const imageResp = await fetch(imageUrl);
    if (!imageResp.ok) {
      throw new Error(`Failed to fetch image: ${imageResp.statusText}`);
    }
    const arrayBuffer = await imageResp.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = imageResp.headers.get("content-type") || "image/jpeg";

    // 2. Gemini API初期化
    const genAI = new GoogleGenerativeAI(apiKey);
    const aiModel = genAI.getGenerativeModel({ 
      model: model || "gemini-1.5-pro" 
    });

    // 3. プロンプト内の変数を置換
    const finalPrompt = customPrompt.replace(
      "{{QUESTION_COUNT}}", 
      questionCount.toString()
    );

    // 4. 生成実行
    const result = await aiModel.generateContent([
      finalPrompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ generatedText: text });

  } catch (error: any) {
    console.error("Generate API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate content" },
      { status: 500 }
    );
  }
}