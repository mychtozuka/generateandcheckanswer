// src/app/generate-image/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

import { createClient } from '@supabase/supabase-js';
import { Loader2, Upload, Send, Copy, FileText, Trash2, Settings, X, Image, Download } from 'lucide-react';

// Supabaseクライアント
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 問題画像生成用のデフォルトテンプレート
const IMAGE_GENERATION_TEMPLATE = `# 役割
あなたは教育用コンテンツの画像生成スペシャリストです。
提供された問題文や指示に基づいて、教育的な図解・グラフ・図形などの画像を生成してください。

# 生成する画像の種類
- 数学の図形（三角形、四角形、円など）
- グラフ（関数、統計など）
- 図表（フローチャート、表など）
- 概念図

# 画像の仕様
- 白い背景に黒い線で描画
- 文字は見やすく大きめに
- シンプルで分かりやすいデザイン
`;

export default function GenerateImagePage() {
    // State
    const [prompt, setPrompt] = useState<string>('');
    const [referenceFile, setReferenceFile] = useState<File | null>(null);
    const [referencePreviewUrl, setReferencePreviewUrl] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string>('');
    const [dragActive, setDragActive] = useState(false);

    // Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [systemPrompt, setSystemPrompt] = useState(IMAGE_GENERATION_TEMPLATE);
    const [originalPrompt, setOriginalPrompt] = useState(IMAGE_GENERATION_TEMPLATE);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [showMasterTemplateModal, setShowMasterTemplateModal] = useState(false);

    const dropAreaRef = useRef<HTMLLabelElement | null>(null);

    // 右クリックで表示するカスタムコンテキストメニューの状態
    const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number }>({
        visible: false,
        x: 0,
        y: 0,
    });

    useEffect(() => {
        const hide = () => setContextMenu((s) => ({ ...s, visible: false }));
        window.addEventListener('scroll', hide);
        window.addEventListener('resize', hide);
        window.addEventListener('click', hide);
        return () => {
            window.removeEventListener('scroll', hide);
            window.removeEventListener('resize', hide);
            window.removeEventListener('click', hide);
        };
    }, []);

    // クリップボード貼り付けで画像を受け取るハンドラ
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            try {
                const clipboard = (e.clipboardData || (window as any).clipboardData) as DataTransfer | undefined;
                if (!clipboard) return;

                for (let i = 0; i < clipboard.items.length; i++) {
                    const item = clipboard.items[i];
                    if (item && item.type && item.type.startsWith('image/')) {
                        const file = item.getAsFile();
                        if (file) {
                            e.preventDefault();
                            processFile(file);
                            break;
                        }
                    }
                }
            } catch (err) {
                console.error('Paste handling error:', err);
            }
        };

        window.addEventListener('paste', handlePaste as EventListener);
        return () => window.removeEventListener('paste', handlePaste as EventListener);
    }, []);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
    };

    // コンテキストメニューから貼り付けを行う
    const handleContextPaste = async () => {
        setContextMenu((s) => ({ ...s, visible: false }));
        try {
            if (navigator.clipboard && (navigator.clipboard as any).read) {
                const items = await (navigator.clipboard as any).read();
                for (const item of items) {
                    for (const type of item.types) {
                        if (type.startsWith('image/')) {
                            const blob = await item.getType(type);
                            const file = new File([blob], `clipboard-image.${blob.type.split('/')[1] || 'png'}`, { type: blob.type });
                            processFile(file);
                            return;
                        }
                    }
                }
                alert('クリップボードに画像が見つかりませんでした');
                return;
            }

            alert('このブラウザでは右クリックからの貼り付けはサポートされていません。Ctrl+V をお試しください。');
        } catch (err) {
            console.error('Context paste failed:', err);
            alert('貼り付けに失敗しました');
        }
    };

    // ファイル操作ハンドラ
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            processFile(selectedFile);
        }
    };

    const processFile = (selectedFile: File) => {
        const url = selectedFile.type.startsWith('image/')
            ? URL.createObjectURL(selectedFile)
            : null;
        setReferenceFile(selectedFile);
        setReferencePreviewUrl(url);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleClearFile = () => {
        setReferenceFile(null);
        setReferencePreviewUrl(null);
    };

    // 送信処理
    const handleSubmit = async () => {
        if (!prompt.trim()) {
            alert('生成したい画像の説明を入力してください');
            return;
        }

        setLoading(true);
        setGeneratedImageUrl('');

        try {
            let referenceImageUrl = null;

            // 参考画像がある場合はアップロード
            if (referenceFile) {
                const fileExt = referenceFile.name.split('.').pop();
                const fileName = `ref-${Date.now()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('question-images')
                    .upload(fileName, referenceFile);

                if (uploadError) {
                    throw new Error(`画像アップロード失敗: ${uploadError.message}`);
                }

                const { data: urlData } = supabase.storage
                    .from('question-images')
                    .getPublicUrl(fileName);

                referenceImageUrl = urlData.publicUrl;
            }

            // 画像生成APIに送信
            const res = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt,
                    referenceImageUrl: referenceImageUrl,
                    customPrompt: systemPrompt,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setGeneratedImageUrl(data.imageUrl);
            } else {
                alert(`エラー: ${data.error || '画像生成に失敗しました'}`);
            }

        } catch (error: any) {
            console.error(error);
            alert(`処理エラー: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // 画像をダウンロード
    const downloadImage = async () => {
        if (!generatedImageUrl) return;

        try {
            const response = await fetch(generatedImageUrl);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `generated-image-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download failed:', err);
            alert('ダウンロードに失敗しました');
        }
    };

    // 設定を保存する
    const saveSettings = async () => {
        setIsSavingSettings(true);
        try {
            // TODO: 設定保存API
            setOriginalPrompt(systemPrompt);
            setShowSettings(false);
            alert('設定を保存しました');
        } catch (error) {
            console.error(error);
            alert('設定の保存に失敗しました');
        } finally {
            setIsSavingSettings(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 p-8">
            <div className="max-w-7xl mx-auto">
                {/* ヘッダー */}
                <header className="mb-8 flex items-center justify-between border-b border-gray-200 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-500 p-2 rounded-lg text-white">
                            <Image size={24} strokeWidth={3} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                                問題画像生成
                                <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-normal">
                                    試作中
                                </span>
                            </h1>
                            <p className="text-xs text-gray-500 font-medium">
                                AIによる教育用画像生成ツール
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowSettings(true)}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <span>プロンプト設定</span>
                            <Settings size={18} />
                        </button>
                    </div>
                </header>

                {/* ナビゲーション */}


                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 左カラム：入力エリア */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Image size={20} /> 画像生成設定
                            </h2>
                        </div>

                        <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2">
                            {/* プロンプト入力 */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    生成したい画像の説明 <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="例：直角三角形ABCを描いてください。Aが直角で、BCが斜辺です。各辺に長さa, b, cとラベルをつけてください。"
                                    className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm resize-none"
                                />
                            </div>

                            {/* 参考画像アップロード（オプション） */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    参考画像（任意）
                                </label>
                                <p className="text-xs text-gray-500 mb-3">
                                    似たスタイルで生成したい場合に参考画像をアップロードできます。
                                </p>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="file-upload"
                                    />
                                    <label
                                        ref={dropAreaRef}
                                        htmlFor="file-upload"
                                        onContextMenu={handleContextMenu}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={`flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all
                      ${dragActive ? 'border-orange-500 bg-orange-50 scale-[1.02]' : 'border-gray-300 hover:bg-gray-100'}
                      ${referenceFile ? 'bg-gray-100 border-solid' : ''}`}
                                    >
                                        {referenceFile ? (
                                            <div className="flex items-center gap-4 w-full h-full p-4 relative">
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        handleClearFile();
                                                    }}
                                                    className="absolute top-2 right-2 p-1 bg-white text-red-500 rounded-full shadow-sm hover:bg-red-50 border border-gray-200 z-10"
                                                >
                                                    <Trash2 size={14} />
                                                </button>

                                                {referencePreviewUrl ? (
                                                    <img src={referencePreviewUrl} alt="Preview" className="h-full object-contain rounded" />
                                                ) : (
                                                    <div className="flex items-center gap-2 text-gray-500">
                                                        <FileText size={24} />
                                                        <span className="text-sm">{referenceFile.name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                <Upload size={24} className="text-gray-400" />
                                                <p className="text-xs text-gray-500">クリック、ドラッグ、または Ctrl+V</p>
                                            </>
                                        )}
                                    </label>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={loading || !prompt.trim()}
                            className={`w-full mt-4 py-4 px-4 rounded-lg text-white font-bold text-lg flex items-center justify-center gap-2 transition-all shrink-0 shadow-lg
                ${loading || !prompt.trim() ? 'bg-gray-300 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 hover:translate-y-[-2px]'}`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" /> 生成中...
                                </>
                            ) : (
                                <>
                                    <Image size={20} /> 画像を生成する
                                </>
                            )}
                        </button>
                    </div>

                    {/* 右カラム：結果表示エリア */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2 shrink-0">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <FileText size={20} /> 生成結果
                            </h2>
                            {generatedImageUrl && (
                                <button
                                    onClick={downloadImage}
                                    className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded transition-colors"
                                >
                                    <Download size={14} /> ダウンロード
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg border border-gray-200 p-4 relative flex items-center justify-center">
                            {generatedImageUrl ? (
                                <img
                                    src={generatedImageUrl}
                                    alt="Generated"
                                    className="max-w-full max-h-full object-contain rounded-lg shadow"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-gray-400 space-y-3">
                                    <Image size={48} />
                                    <p className="text-center">
                                        左側で画像の説明を入力して<br />
                                        「画像を生成する」ボタンを押してください。
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* カスタムコンテキストメニュー */}
            {contextMenu.visible && (
                <div
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    className="fixed z-50 bg-white border border-gray-200 rounded shadow-md"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={handleContextPaste}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                    >
                        貼り付け (クリップボードの画像)
                    </button>
                </div>
            )}

            {/* 設定モーダル */}
            {showSettings && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Settings size={20} /> 画像生成プロンプト設定
                            </h3>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <p className="text-sm text-gray-500 mb-4">
                                画像生成に使用するAIへの指示（システムプロンプト）を編集できます。
                            </p>
                            <textarea
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                className="w-full h-[400px] p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none font-mono text-sm leading-relaxed resize-none"
                                placeholder="システムプロンプトを入力..."
                            />
                        </div>

                        <div className="p-4 border-t border-gray-200 flex justify-between bg-gray-50 rounded-b-xl">
                            <button
                                onClick={() => setShowMasterTemplateModal(true)}
                                className="px-4 py-2 text-sm text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded-lg transition-colors border border-orange-300"
                            >
                                マスターテンプレート表示
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setSystemPrompt(originalPrompt);
                                        setShowSettings(false);
                                    }}
                                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={saveSettings}
                                    disabled={isSavingSettings}
                                    className="px-6 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors shadow-sm disabled:bg-orange-300 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isSavingSettings && <Loader2 size={16} className="animate-spin" />}
                                    {isSavingSettings ? '保存中...' : '設定を保存'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* マスターテンプレート表示モーダル */}
            {showMasterTemplateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Settings size={20} /> マスターテンプレート（参照用）
                            </h3>
                            <button
                                onClick={() => setShowMasterTemplateModal(false)}
                                className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <textarea
                                value={IMAGE_GENERATION_TEMPLATE}
                                readOnly
                                className="w-full h-[400px] p-4 border border-gray-300 rounded-lg font-mono text-sm leading-relaxed resize-none bg-gray-50"
                            />
                        </div>

                        <div className="p-4 border-t border-gray-200 flex justify-end bg-gray-50 rounded-b-xl">
                            <button
                                onClick={() => setShowMasterTemplateModal(false)}
                                className="px-6 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
