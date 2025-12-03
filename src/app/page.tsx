// src/app/page.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Loader2, Upload, Send, CheckCircle, FileText, Trash2 } from 'lucide-react';

// Supabaseクライアント
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

  const handleTextChange = (id: number, value: string) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, text: value } : q));
  };

  const handleFileChange = (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
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

    try {
      let completedCount = 0;
      const totalCount = activeQuestions.length;

      // 1問ずつ順番に処理 (クライアント側でループ)
      for (const q of questions) {
        if (!q.text && !q.file) continue;

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
            model
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
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            System Online
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
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[80px] text-sm"
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
                        {q.previewUrl ? (
                          <img src={q.previewUrl} alt="Preview" className="h-8 w-8 object-cover rounded" />
                        ) : (
                          <FileText size={16} className="text-blue-500" />
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
                {loading ? `AIが思考中... (${progress}%)` : 'まとめて解答を作成する'}
              </div>
            </button>
          </div>

          {/* 右カラム：結果表示エリア */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[85vh] flex flex-col">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 pb-2 border-b border-gray-100 shrink-0">
              <CheckCircle size={20} /> 解答結果
            </h2>
            
            <div className="overflow-y-auto flex-1 pr-2">
              {results.length > 0 ? (
                <div className="space-y-6">
                  {results.map((ans, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 font-bold text-gray-700 border-b border-gray-200">
                        No.{index + 1} の解答
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
                  ))}
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
    </div>
  );
}