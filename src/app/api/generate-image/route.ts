// src/app/api/generate-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, referenceImageUrl, customPrompt } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'プロンプトは必須です' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'API Keyが設定されていません' }, { status: 500 });
        }

        // システムプロンプトとユーザープロンプトを結合
        const fullPrompt = `${customPrompt || ''}\n\n# ユーザーからのリクエスト\n${prompt}`;

        // GoogleGenAI クライアントを初期化
        const ai = new GoogleGenAI({ apiKey });

        // Imagen 4 を使用して画像を生成
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: fullPrompt,
            config: {
                numberOfImages: 1,
            },
        });

        if (!response.generatedImages || response.generatedImages.length === 0) {
            return NextResponse.json({ error: '画像の生成に失敗しました' }, { status: 500 });
        }

        // Base64画像をデータURLとして返す
        const imgBytes = response.generatedImages[0].image?.imageBytes;
        if (!imgBytes) {
            return NextResponse.json({ error: '画像データの取得に失敗しました' }, { status: 500 });
        }

        const imageDataUrl = `data:image/png;base64,${imgBytes}`;

        return NextResponse.json({
            imageUrl: imageDataUrl,
            success: true
        });

    } catch (error: any) {
        console.error('Image generation error:', error);
        return NextResponse.json(
            { error: error.message || '画像生成中にエラーが発生しました' },
            { status: 500 }
        );
    }
}
