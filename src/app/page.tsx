// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Loader2, Upload, Send, CheckCircle, FileText, Trash2, Settings, X } from 'lucide-react';

// Supabaseクライアント
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MASTER_TEMPLATE = `# 前提条件とデータ処理ルール
(ここは必要に応じて調整可能ですが、LaTeXエスケープと$//$無視は維持推奨)

1. **入力データのクリーニング:**
   - 入力テキストに含まれる \`$//$\` という文字列は、システム内部の改行コードです。これは文脈上の意味を持たないため、**完全に無視（削除、または半角スペースに置換）して**内容を読み取ってください。
   - \`$//$\`によって文章が分断されている場合でも、人間が読むのと同じように自然な一文として繋げて解釈してください。

2. **数式（LaTeX）の取り扱い:**
   - 入力に含まれるLaTeX形式の数式（分数、ルートなど）は、その数学的な意味を保持したまま問題作成に使用してください。
   - **重要:** 後続のシステム処理のため、出力に含まれる**LaTeXコマンドのバックスラッシュ（\\）は必ず二重バックスラッシュ（\\\\）にエスケープ**して記述してください。
     - 例: \`\\frac{1}{2}\` → \`\\\\frac{1}{2}\`

★ここは自由に変更可能（役割定義・ミッション）★
あなたは学習塾のベテラン講師であり、教材の「最終動作確認」担当です。
入力された「問題文」、「問題画像（ある場合）」、および「登録されている正解データ（ある場合）」を照合し、不備の検出または正解の生成を行ってください。

■入力データについて
・画像は添付されない場合があります（テキストのみの問題の場合）。
・プロンプトの最下部に検証対象のデータが提示されます。
・「CSVに登録されている正解データ」が「(未登録)」または空欄の場合は、あなたが正解を作成してください。

■最重要ミッション
1. **画像の必要性チェック**: 画像がない場合、問題文が図表を必要としているか判定してください。
2. **解答の導出**: 問題を解き、正解を導き出してください。
3. **正解照合・生成**:
   - **正解データがある場合**: あなたの導き出した正解と、入力された「CSVの正解データ」を比較し、致命的な誤りがないか確認してください。
   - **正解データがない（未登録）場合**: あなたの導き出した正解をそのまま出力してください（不備判定はスキップ）。

★ここは自由に変更可能（判断基準）★
■判断基準（優先度順）

1. 画像不足の判定（最優先）
**入力に「画像」がなく、かつ「問題文」に図表を参照する記述がある場合、即座に不備として報告してください。**
・判定キーワード例：「図のように」「右の図」「グラフ」「表」「斜線部」「頂点A」（図がないと位置が不明な場合）
・この場合、計算等は行わず、「解答には図表が必要です」と出力してください。

2. 「図の見た目」の絶対優位性（図がある場合）
テキストと図で配置や位置関係が食い違っている場合、**100%「図」の方を正解として扱ってください。**
図を見て常識的に解けるなら、問題文の細かい記述ミスは「修正なし」とみなします。

3. 正解データの検証（データがある場合のみ）
あなたの答えとCSVの正解データを比較する際、**「数学的に同じ意味」であれば「一致（不備なし）」**と判定してください。
・全角半角、スペースの有無、表記の揺れ（3.5と7/2など）は無視して一致とみなします。

4. 指摘すべき致命的なエラー
以下のいずれかに該当する場合のみ、出力を行ってください。
・**画像の欠落**: 問題文が図を参照しているのに画像がない。
・**模範解答の誤り**: 「CSVの正解データ」が存在し、かつその内容が明らかに間違っている。
・**数値情報の欠落**: 画像はあるが、計算に必要な数値が足りず解が出せない。
・**数学的な破綻**: 計算不能な矛盾がある。

5. 読み取りミスの自己責任
画像認識で数値が読み取れない場合、「自分の読み間違い」と仮定して、CSVの正解データや図の見た目から逆算し、つじつまが合う解釈を採用してください。

★ここは自由に変更可能（出力形式）★
■出力形式（厳守）
・マークダウン記号（**など）は使用禁止。
・プレーンテキストのみ。

■出力フォーマット

判定結果に応じて、以下のいずれかを出力してください。

【パターンA：不備がある場合】
【指摘事項】
[致命的なエラー]
・内容：(以下のいずれかを記述)
  - 「解答には図表が必要です」（画像不足の場合）
  - 「模範解答の誤り。正しくは〇〇ですが、CSVは××となっています」
  - 「条件不足で解けません」
・修正案：(例：「画像をアップロードしてください」「CSVの正解1を修正してください」)

【正解】
(AIが算出した正しい答え。LaTeXバックスラッシュは二重にする。画像不足で解けない場合は「判別不能」と記述)

【パターンB：問題がない、または正解生成のみの場合】
修正の必要はありません
【正解】
(AIが算出した答えのみ記述。LaTeXバックスラッシュは二重にする)

---
■検証対象データ
(※ここから下はコードとの接続部のため、変数名を含め変更禁止)

【問題文】
{{PROBLEM_TEXT}}

【CSVに登録されている正解データ】
{{CORRECT_ANSWER_OR_EMPTY}}`;

type QuestionInput = {
  id: number;
  text: string;
  file: File | null;
  previewUrl: string | null;
};

export default function Home() {
  const [questions, setQuestions] = useState<QuestionInput[]>(
    Array.from({ length: 5 }, (_, i) => ({ id: i + 1, text: '', file: null, previewUrl: null }))
  );
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [model, setModel] = useState('gemini-2.5-pro');
  const [dragActiveId, setDragActiveId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0); // 進捗率 (0-100)
  const [processingStatus, setProcessingStatus] = useState(''); // 進捗状況テキスト
  const [showSettings, setShowSettings] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(MASTER_TEMPLATE);
  const [originalPrompt, setOriginalPrompt] = useState(MASTER_TEMPLATE);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showMasterTemplateModal, setShowMasterTemplateModal] = useState(false);

  // サーバーから設定を読み込む
  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        const res = await fetch('/api/settings/prompt');
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

  // 設定を保存する
  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/settings/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: systemPrompt }),
      });

      if (!res.ok) {
        throw new Error('Failed to save settings');
      }
      
      setOriginalPrompt(systemPrompt);
      setShowSettings(false);
      alert('設定を保存しました（全ユーザーに適用されます）');
    } catch (error) {
      console.error(error);
      alert('設定の保存に失敗しました');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleTextChange = (id: number, value: string) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, text: value } : q));
  };

  const handleFileChange = (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      // 画像ならプレビューURLを作成、PDFならnull（アイコン表示に使用）
      const previewUrl = selectedFile.type.startsWith('image/') 
        ? URL.createObjectURL(selectedFile) 
        : null;

      setQuestions(prev => prev.map(q => q.id === id ? { ...q, file: selectedFile, previewUrl } : q));
    }
  };

  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveId(id);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveId(null);
  };

  const handleDrop = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveId(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      const previewUrl = selectedFile.type.startsWith('image/') 
        ? URL.createObjectURL(selectedFile) 
        : null;

      setQuestions(prev => prev.map(q => q.id === id ? { ...q, file: selectedFile, previewUrl } : q));
    }
  };

  const handleClearFile = (id: number) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, file: null, previewUrl: null } : q));
  };

  const handleSubmit = async () => {
    // 少なくとも1つの問題が入力されているかチェック
    const activeQuestions = questions.filter(q => q.text || q.file);
    if (activeQuestions.length === 0) return;

    setLoading(true);
    setResults(new Array(5).fill('')); // 結果を初期化
    setProgress(0);
    setProcessingStatus('準備中...');

    try {
      let completedCount = 0;
      const totalCount = activeQuestions.length;

      // 1問ずつ順番に処理 (クライアント側でループ)
      for (const q of questions) {
        if (!q.text && !q.file) continue;

        // 進捗状況を更新
        setProcessingStatus(`${completedCount + 1}/${totalCount}問目をチェック中`);

        let publicFileUrl = null;

        // ファイルがあればアップロード
        if (q.file) {
          const fileExt = q.file.name.split('.').pop();
          const fileName = `${Date.now()}-${q.id}.${fileExt}`;

          const { error } = await supabase.storage
            .from('question-images')
            .upload(fileName, q.file);

          if (error) {
            console.error(`アップロードエラー(No.${q.id}): ${error.message}`);
            setResults(prev => {
              const newResults = [...prev];
              newResults[q.id - 1] = `（エラー: 画像アップロード失敗 - ${error.message}）`;
              return newResults;
            });
            continue; // 次の問題へ
          }

          const { data: urlData } = supabase.storage
            .from('question-images')
            .getPublicUrl(fileName);
          
          publicFileUrl = urlData.publicUrl;
        }

        // APIにデータを送信 (単一リクエスト)
        const res = await fetch('/api/solve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: q.text,
            imageUrl: publicFileUrl,
            model,
            customPrompt: systemPrompt
          }),
        });

        const data = await res.json();
        
        // 結果を更新
        setResults(prev => {
          const newResults = [...prev];
          if (res.ok) {
            newResults[q.id - 1] = data.answer;
          } else {
            newResults[q.id - 1] = `（エラー: ${data.error}）`;
          }
          return newResults;
        });

        // 進捗更新
        completedCount++;
        setProgress(Math.round((completedCount / totalCount) * 100));
      }

    } catch (error: any) {
      console.error(error);
      alert(`処理中にエラーが発生しました: ${error.message || '不明なエラー'}`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex items-center justify-between border-b border-gray-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <CheckCircle size={24} strokeWidth={3} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                Generate&CheckAnswer
              </h1>
              <p className="text-xs text-gray-500 font-medium">
                社内用 作問ダブルチェックツール
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/batch"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span>CSV一括チェック</span>
              <FileText size={18} />
            </Link>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="プロンプト設定"
            >
              <span>プロンプト設定</span>
              <Settings size={18} />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左カラム：入力エリア */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Upload size={20} /> 問題を入力
              </h2>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              >
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (高精度)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (高速)</option>
              </select>
            </div>

            <div className="space-y-6 overflow-y-auto pr-2 flex-1">
              {questions.map((q) => (
                <div key={q.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="font-bold text-gray-500 mb-2">No.{q.id}</div>
                  <div className="space-y-3">
                    <textarea
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[160px] text-sm"
                      placeholder={`問題文 No.${q.id}`}
                      value={q.text}
                      onChange={(e) => handleTextChange(q.id, e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <input 
                          type="file" 
                          accept="image/*,.pdf" 
                          onChange={(e) => handleFileChange(q.id, e)}
                          className="hidden"
                          id={`file-input-${q.id}`}
                        />
                        <label 
                          htmlFor={`file-input-${q.id}`}
                          onDragOver={(e) => handleDragOver(e, q.id)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, q.id)}
                          className={`flex items-center justify-center gap-2 w-full p-2 border border-dashed rounded-lg cursor-pointer transition text-sm text-gray-600
                            ${dragActiveId === q.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-100'}`}
                        >
                          <Upload size={16} />
                          {q.file ? 'ファイル変更' : '画像/PDFをドラッグ＆ドロップ'}
                        </label>
                      </div>
                      {q.file && (
                        <button 
                          onClick={() => handleClearFile(q.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          title="ファイルを削除"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                    {q.file && (
                      <div className="text-xs text-gray-500 flex items-center gap-2 bg-white p-2 rounded border border-gray-200">
                        {q.file.type.startsWith('image/') && q.previewUrl ? (
                          <img src={q.previewUrl} alt="Preview" className="h-8 w-8 object-cover rounded" />
                        ) : (
                          <div className="h-8 w-8 flex items-center justify-center bg-red-100 text-red-500 rounded">
                            <FileText size={16} />
                          </div>
                        )}
                        <span className="truncate flex-1">{q.file.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !questions.some(q => q.text || q.file)}
              className={`w-full mt-4 py-3 px-4 rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-all shrink-0 shadow-lg relative overflow-hidden
                ${loading || !questions.some(q => q.text || q.file) ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {/* 進捗バー背景 */}
              {loading && (
                <div 
                  className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              )}
              
              <div className="relative z-10 flex items-center gap-2">
                {loading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                {loading ? `AIが思考中... (${processingStatus})` : 'まとめて解答を作成する'}
              </div>
            </button>
          </div>

          {/* 右カラム：結果表示エリア */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[85vh] flex flex-col">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 pb-2 border-b border-gray-100 shrink-0">
              <CheckCircle size={20} /> 解答結果
              <span className="ml-2 text-xs font-normal text-gray-500">（AIの出力は必ずしも正しいとは限りません）</span>
            </h2>
            
            <div className="overflow-y-auto flex-1 pr-2">
              {results.length > 0 ? (
                <div className="space-y-6">
                  {results.map((ans, index) => {
                    const question = questions[index];
                    const fileName = question.file ? question.file.name.replace(/\.[^/.]+$/, "") : null;
                    const title = fileName ? `${fileName} の解答` : `No.${index + 1} の解答`;

                    return (
                      <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-100 px-4 py-2 font-bold text-gray-700 border-b border-gray-200">
                          {title}
                        </div>
                        <div className="p-4 prose prose-blue max-w-none bg-white">
                          <div className={`whitespace-pre-wrap leading-relaxed ${
                            ans.startsWith('（エラー') || ans.startsWith('（AI生成エラー') || ans.startsWith('（画像') 
                              ? 'text-red-600 font-medium bg-red-50 p-4 rounded border border-red-100' 
                              : 'text-gray-800'
                          }`}>
                            {ans}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3">
                  <p className="text-center">左側のフォームから問題を送信してください。<br />ここにAIの解答が表示されます。</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 設定モーダル */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Settings size={20} /> プロンプト設定
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
                AIに指示するシステムプロンプトを編集できます。
                <br />※設定はサーバーに保存され、<span className="font-bold text-red-500">全社員（全ユーザー）に適用されます</span>。
              </p>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full h-[400px] p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm leading-relaxed resize-none"
                placeholder="システムプロンプトを入力..."
              />
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-between bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowMasterTemplateModal(true)}
                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors border border-blue-300"
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
                  className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSavingSettings && <Loader2 size={16} className="animate-spin" />}
                  {isSavingSettings ? '保存中...' : '設定を保存して閉じる'}
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
              <p className="text-sm text-gray-500 mb-4">
                これはマスターテンプレートです。参照用として表示しています。
              </p>
              <textarea
                value={MASTER_TEMPLATE}
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