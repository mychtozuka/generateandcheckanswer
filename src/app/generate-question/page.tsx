// src/app/generate-question/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Loader2, Upload, Send, Copy, FileText, Trash2, Settings, X, RefreshCw, Calculator } from 'lucide-react';

// Supabaseクライアント
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 類題作成用のデフォルトテンプレート
const GENERATION_TEMPLATE = `# 役割
あなたは中学校数学の教材作成スペシャリストです。
提供された「元の問題（画像またはPDF）」を分析し、**その形式（レイアウト）を維持したまま**、学習効果の高い類題を作成してください。

# 作成指示（対象と数量）
1. **対象の特定**:
  - 画像内で**「問題番号に丸がついている」**または**「チェック印がある」**問題をすべて特定してください。
  - もし印が一切ない場合は、画像内の「すべての問題（または主要な問題）」を対象としてください。
2. **作成数**:
  - 特定した **「それぞれの問題」につき、{{QUESTION_COUNT}}問ずつ** 類題を作成してください。
  - 例: 丸がついている問題が5個あり、指定数が「1問」の場合 → **計5問**（各1問）を出力。

{{ADD_PROMPT}}

# 最重要：レイアウトの再現ルール
**読みやすさを最優先し、余計な装飾線（マークダウンの表など）は使用しないでください。**

1. **小問の並べ方**:
  - 元画像が「表」や「横並び」であっても、出力時は **シンプルな縦並びのリスト** に変換してください。
  - マークダウンの表（\`|\` や \`---\`）は**使用禁止**です。
  - 例:
    ① 2x+5
    ② 3a-b

2. **穴埋め形式**:
  - 元画像に \`[ ]\` や \`( )\` がある場合、**（ ① ）** という形式を使って空欄を作ってください。
  - 文脈や行の並び（仮定→結論の流れ）は維持してください。

# テキスト表記ルール（CSV仕様）
1. **半角統一**: 数字、アルファベット、記号（+, -, =, :）はすべて**半角**を使用してください。
2. **スペース削除**: 数式内の演算子の前後には**スペースを入れない**でください。
  - 良い例: \`2x+5=10\`
  - 悪い例: \`2x + 5 = 10\`
3. **単位**: 単位が必要な文章題では、文末に \`（単位をつけて答えよ）\` と記述してください。

# LaTeXの使用ルール（厳守）
システムで正しく表示させるため、以下のルールを守ってください。
1. **適用範囲**:
  - **累乗（指数）**、分数、ルート、特殊な記号を含む数式は、必ず LaTeX形式（\`$\`で囲む）を使用してください。
    - 例: \`$x^2$\`, \`$\\frac{1}{2}$\`, \`$\\sqrt{2}$\`
  - 単純な文字（n, x）や整数、一次方程式（乗数を含まないもの）は LaTeXを使わずテキストで記述してください。
    - 例: \`2x+3=5\`, \`y\`
2. **記述形式**:
  - LaTeXコマンドのバックスラッシュは **1本（\`\\\`）** で記述してください。

# 出力フォーマット
※以下の形式に従い出力してください。

---
## 類題 1
(ここに、丸がついた1つ目の問題の類題を記述)
(形式は元画像を再現すること)

**【解答】**
(解答を記述)

---
## 類題 2
(ここに、丸がついた2つ目の問題の類題を記述)
...

---
`;

export default function GenerateQuestionPage() {
  // State
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState<number>(3); // デフォルト3問
  const [additionalInstruction, setAdditionalInstruction] = useState<string>(''); // 追加指示

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [model, setModel] = useState('gemini-3-flash-preview');
  const [dragActive, setDragActive] = useState(false);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(GENERATION_TEMPLATE);
  const [originalPrompt, setOriginalPrompt] = useState(GENERATION_TEMPLATE);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showMasterTemplateModal, setShowMasterTemplateModal] = useState(false);

  // サーバーから設定を読み込む（チェックツールとは別のキーで保存・取得することを想定）
  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        // 類題作成用のプロンプト設定APIエンドポイント
        const res = await fetch('/api/settings/generate-prompt');
        if (res.ok) {
          const data = await res.json();
          if (data.prompt) {
            setSystemPrompt(data.prompt);
            setOriginalPrompt(data.prompt);
          }
        }
      } catch (error) {
        console.error('Failed to fetch prompt settings:', error);
      }
    };
    fetchPrompt();
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

  // 右クリックで表示するカスタムコンテキストメニューの状態
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0,
  });
  const dropAreaRef = useRef<HTMLLabelElement | null>(null);

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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
  };

  // コンテキストメニューから貼り付けを行う
  const handleContextPaste = async () => {
    setContextMenu((s) => ({ ...s, visible: false }));
    try {
      // 最新ブラウザ向け API
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

      // フォールバック: 古いブラウザでは read() が無いため、ユーザーに Ctrl+V を案内
      alert('このブラウザでは右クリックからの貼り付けはサポートされていません。Ctrl+V または右クリックメニューの代替をお試しください。');
    } catch (err) {
      console.error('Context paste failed:', err);
      alert('貼り付けに失敗しました（権限やブラウザの制限の可能性があります）');
    }
  };

  // 設定を保存する
  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/settings/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: systemPrompt }),
      });

      if (!res.ok) {
        throw new Error('Failed to save settings');
      }

      setOriginalPrompt(systemPrompt);
      setShowSettings(false);
      alert('類題作成用の設定を保存しました');
    } catch (error) {
      console.error(error);
      alert('設定の保存に失敗しました');
    } finally {
      setIsSavingSettings(false);
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
    setFile(selectedFile);
    setPreviewUrl(url);
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
    setFile(null);
    setPreviewUrl(null);
  };

  // 送信処理
  const handleSubmit = async () => {
    if (!file) return;

    setLoading(true);
    setResult('');

    try {
      let publicFileUrl = null;

      // 1. 画像/PDFをSupabaseにアップロード
      const fileExt = file.name.split('.').pop();
      const fileName = `gen-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('question-images')
        .upload(fileName, file);

      if (uploadError) {
        throw new Error(`画像アップロード失敗: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('question-images')
        .getPublicUrl(fileName);

      publicFileUrl = urlData.publicUrl;

      // 2. 生成APIに送信
      // チェックツールとは別のAPIルート(/api/generate)を使用すると想定
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: publicFileUrl,
          questionCount: questionCount,
          model,
          customPrompt: systemPrompt,
          additionalInstruction: additionalInstruction
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data.generatedText);
      } else {
        setResult(`（エラー: ${data.error || '生成に失敗しました'}）`);
      }

    } catch (error: any) {
      console.error(error);
      setResult(`（処理エラー: ${error.message}）`);
    } finally {
      setLoading(false);
    }
  };

  // 結果コピー機能
  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    alert('結果をクリップボードにコピーしました');
  };

  // 生成テキストを解析して {question, answer, raw} の配列を返す
  const parseGeneratedToPairs = (text: string) => {
    const pairs: { question: string; answer: string; raw: string }[] = [];
    // セクション分割: ## 類題 N または --- 区切りを想定
    const sectionRegex = /##\s*類題\s*\d+[\s\S]*?(?=(?:##\s*類題\s*\d+)|$)/g;
    const sections = text.match(sectionRegex) || [];

    if (sections.length === 0) {
      // フォールバック: --- 区切りで分割
      const parts = text.split(/^---$/m).map(s => s.trim()).filter(Boolean);
      for (const p of parts) {
        const qa = splitQuestionAnswer(p);
        pairs.push({ question: qa.question, answer: qa.answer, raw: p });
      }
      return pairs;
    }

    for (const s of sections) {
      const qa = splitQuestionAnswer(s);
      pairs.push({ question: qa.question, answer: qa.answer, raw: s });
    }
    return pairs;
  };

  const splitQuestionAnswer = (section: string) => {
    // 解答ブロックは「【解答】」を想定
    const answerMarker = /【解答】/;
    const idx = section.search(answerMarker);
    if (idx === -1) {
      return { question: section.trim(), answer: '' };
    }
    const question = section.slice(0, idx).replace(/##\s*類題\s*\d+/i, '').trim();
    const answer = section.slice(idx).replace(/【解答】/i, '').trim();
    return { question, answer };
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <header className="mb-8 flex items-center justify-between border-b border-gray-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-600 p-2 rounded-lg text-white">
              <Calculator size={24} strokeWidth={3} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                Generate Question
              </h1>
              <p className="text-xs text-gray-500 font-medium">
                中学数学 類題生成ツール
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
        <nav className="mb-6 flex items-center gap-4">
          <Link
            href="/"
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-600"
          >
            Generate&CheckAnswer
          </Link>
          <Link
            href="/generate-question"
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
          >
            GenerateQuestion
          </Link>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左カラム：入力エリア */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Upload size={20} /> 元となる問題
              </h2>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:outline-none bg-white"
              >
                <option value="gemini-3-pro-preview">Gemini 3 Pro Preview (高精度)</option>
                <option value="gemini-3-flash-preview">Gemini 3 Flash Preview (高速)</option>
                <option value="gemini-3-pro-preview">Gemini 3 Pro Preview (最新)</option>
              </select>
            </div>

            <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2">
              {/* ドラッグ＆ドロップエリア */}
              <div className="relative">
                <input
                  type="file"
                  accept="image/*,.pdf"
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
                  className={`flex flex-col items-center justify-center gap-4 w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all
                    ${dragActive ? 'border-green-500 bg-green-50 scale-[1.02]' : 'border-gray-300 hover:bg-gray-50'}
                    ${file ? 'bg-gray-50 border-solid' : ''}`}
                >
                  {file ? (
                    <div className="flex flex-col items-center w-full h-full p-4 relative">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleClearFile();
                        }}
                        className="absolute top-2 right-2 p-2 bg-white text-red-500 rounded-full shadow-sm hover:bg-red-50 border border-gray-200 z-10"
                      >
                        <Trash2 size={18} />
                      </button>

                      {previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="h-full object-contain rounded" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                          <FileText size={48} className="mb-2" />
                          <p className="font-medium text-lg">{file.name}</p>
                          <p className="text-sm">PDFファイル</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="p-4 bg-green-100 text-green-600 rounded-full">
                        <Upload size={32} />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-gray-700">クリックしてアップロード</p>
                        <p className="text-sm text-gray-500 mt-1">またはファイルをここにドラッグ＆ドロップ、またはクリップボードから貼り付け (Ctrl+V)
                          <br />右クリックでメニューを表示して貼り付けも可能です。</p>
                        <p className="text-xs text-gray-400 mt-2">画像 (PNG, JPG) または PDF</p>
                      </div>
                    </>
                  )}
                </label>
              </div>

              {/* 設定項目 */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  作成する類題の数
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                  />
                  <span className="font-mono font-bold text-lg w-12 text-center bg-white border border-gray-300 rounded px-2 py-1">
                    {questionCount}
                  </span>
                  <span className="text-sm text-gray-600">問</span>
                </div>
              </div>

              {/* 追加指示 */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  追加指示（任意）
                </label>
                <textarea
                  value={additionalInstruction}
                  onChange={(e) => setAdditionalInstruction(e.target.value)}
                  placeholder="例：難易度を上げる、具体的な数値範囲を指定する など"
                  className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm resize-none"
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !file}
              className={`w-full mt-4 py-4 px-4 rounded-lg text-white font-bold text-lg flex items-center justify-center gap-2 transition-all shrink-0 shadow-lg
                ${loading || !file ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 hover:translate-y-[-2px]'}`}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" /> 生成中...
                </>
              ) : (
                <>
                  <RefreshCw size={20} /> 類題を作成する
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
              {result && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded transition-colors"
                  >
                    <Copy size={14} /> コピー
                  </button>

                  <button
                    onClick={() => {
                      try {
                        const pairs = parseGeneratedToPairs(result);
                        if (pairs.length === 0) {
                          alert('解析できる類題が見つかりませんでした');
                          return;
                        }
                        // ヘッダーを横一列に作る: Question 1, Answer 1, Question 2, Answer 2, ...
                        const headers: string[] = [];
                        const values: string[] = [];
                        pairs.forEach((p, i) => {
                          const idx = i + 1;
                          headers.push(`Question ${idx}`);
                          headers.push(`Answer ${idx}`);
                          // フィールド内の改行は実際のCRLFにして、そのまま引用で囲む
                          values.push(p.question.replace(/\r?\n/g, '\r\n'));
                          values.push(p.answer.replace(/\r?\n/g, '\r\n'));
                        });

                        const escape = (s: string) => '"' + s.replace(/"/g, '""') + '"';
                        // ヘッダー行と値行を CRLF で結合（フィールド内の改行は既にCRLF）
                        const csv = [headers.map(escape).join(','), values.map(escape).join(',')].join('\r\n');

                        // UTF-8 BOM を先頭に付与
                        const bom = '\uFEFF';
                        const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        const ts = new Date().toISOString().replace(/[:.]/g, '-');
                        a.download = `generated-questions-${ts}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        console.error('CSV export failed', err);
                        alert('CSVのエクスポートに失敗しました');
                      }
                    }}
                    className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded transition-colors"
                  >
                    CSV エクスポート（横一列）
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg border border-gray-200 p-4 relative">
              {result ? (
                <textarea
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  className="w-full h-full resize-none bg-transparent border-0 outline-none leading-relaxed text-gray-800 font-mono text-sm whitespace-pre-wrap"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 space-y-3">
                  <p className="text-center">
                    左側から問題をアップロードして<br />
                    「類題を作成する」ボタンを押してください。
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
                <Settings size={20} /> 生成プロンプト設定
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
                類題生成に使用するAIへの指示（システムプロンプト）を編集できます。
                <br />※ {'{{QUESTION_COUNT}}'} は指定した問題数に置換されます。
              </p>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full h-[400px] p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none font-mono text-sm leading-relaxed resize-none"
                placeholder="システムプロンプトを入力..."
              />
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-between bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowMasterTemplateModal(true)}
                className="px-4 py-2 text-sm text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors border border-green-300"
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
                  className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:bg-green-400 disabled:cursor-not-allowed flex items-center gap-2"
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
                value={GENERATION_TEMPLATE}
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