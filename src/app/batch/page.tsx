'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Papa from 'papaparse';
import { Upload, FileText, Image as ImageIcon, Play, Loader2, CheckCircle, AlertCircle, Download, Settings, X, StopCircle, Trash2 } from 'lucide-react';

type CsvRow = {
  学年: string;
  教科: string;
  節: string;
  単元: string;
  難易度: string;
  チェックナンバー: string;
  テストナンバー: string;
  [key: string]: string;
};

type BatchItem = {
  id: number;
  key: string;
  fileName: string | null;
  file: File | null;
  status: 'waiting' | 'processing' | 'completed' | 'error' | 'no_file';
  answer: string;
  csvData: CsvRow;
  hasIssue: boolean;
};

export default function BatchPage() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [resourceFiles, setResourceFiles] = useState<File[]>([]);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [model, setModel] = useState('gemini-2.5-pro');
  const abortControllerRef = useRef<AbortController | null>(null);

  // サーバーからプロンプト設定を読み込む
  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        const res = await fetch('/api/settings/prompt');
        if (res.ok) {
          const data = await res.json();
          if (data.prompt) {
            setSystemPrompt(data.prompt);
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
      
      setShowSettings(false);
      alert('設定を保存しました（全ユーザーに適用されます）');
    } catch (error) {
      console.error(error);
      alert('設定の保存に失敗しました');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = (files: File[]) => {
    const newCsv = files.find(f => f.name.endsWith('.csv'));
    const newResources = files.filter(f => !f.name.endsWith('.csv'));

    let updatedResources = resourceFiles;
    if (newResources.length > 0) {
      updatedResources = [...resourceFiles, ...newResources];
      setResourceFiles(updatedResources);
    }

    if (newCsv) {
      setCsvFile(newCsv);
      parseCsv(newCsv, updatedResources);
    } else if (csvFile && newResources.length > 0) {
      // CSVが既に読み込まれていれば再マッチング
      parseCsv(csvFile, updatedResources);
    }
  };

  const parseCsv = (file: File, resources: File[]) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setItems(prevItems => {
          // まずデータをマッピングしてキーを生成
          const mappedData = results.data.map((row) => {
            const key = `${row.学年}-${row.教科}-${row.節}-${row.単元}-${row.難易度}-${row.チェックナンバー}-${row.テストナンバー}`;
            return { row, key };
          });

          // 自然順ソート (数字を数値として比較)
          mappedData.sort((a, b) => {
            return a.key.localeCompare(b.key, 'ja', { numeric: true, sensitivity: 'base' });
          });

          // ソート順でアイテムを生成
          return mappedData.map((data, index) => {
            const { row, key } = data;
            
            // ファイルマッチング (拡張子を除いたファイル名と一致するか)
            const matchedFile = resources.find(f => {
              const nameWithoutExt = f.name.substring(0, f.name.lastIndexOf('.'));
              return nameWithoutExt === key;
            });

            // 既存アイテムの状態を引き継ぐ
            const existingItem = prevItems.find(item => item.key === key);
            
            let status: BatchItem['status'] = matchedFile ? 'waiting' : 'no_file';
            let answer = '';

            if (existingItem) {
               // ファイルが変更されたかチェック
               const isFileChanged = (() => {
                 if (!existingItem.file && !matchedFile) return false;
                 if (!existingItem.file || !matchedFile) return true;
                 return existingItem.file.name !== matchedFile.name || 
                        existingItem.file.size !== matchedFile.size ||
                        existingItem.file.lastModified !== matchedFile.lastModified;
               })();

               // ファイルが変わっていない、かつ既にステータスが進んでいる場合は維持
               if (!isFileChanged && ['completed', 'processing', 'error'].includes(existingItem.status)) {
                 status = existingItem.status;
                 answer = existingItem.answer;
               }
            }

            return {
              id: index + 1,
              key,
              fileName: matchedFile ? matchedFile.name : null,
              file: matchedFile || null,
              status,
              answer,
              csvData: row,
              hasIssue: false
            };
          });
        });
      },
      error: (error) => {
        console.error('CSV Parse Error:', error);
        alert('CSVの読み込みに失敗しました');
      }
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // "data:image/jpeg;base64," のようなプレフィックスを除去してBase64部分だけ返す
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleStartBatch = async () => {
    const targetItems = items.filter(item => item.status === 'waiting' || item.status === 'no_file');
    if (targetItems.length === 0) {
      alert('処理可能なアイテムがありません');
      return;
    }

    setProcessing(true);
    setProgress({ current: 0, total: targetItems.length });
    abortControllerRef.current = new AbortController();

    // 直列処理ループ
    for (let i = 0; i < targetItems.length; i++) {
      // 中止チェック
      if (abortControllerRef.current?.signal.aborted) {
        setProcessing(false);
        alert(`処理を中止しました (${i}/${targetItems.length}件完了)`);
        return;
      }

      const item = targetItems[i];
      
      // ステータスを処理中に更新
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'processing' } : p));

      try {
        // CSVから正解を1～5を取得
        const correctAnswers = [
          item.csvData['正解1'],
          item.csvData['正解2'],
          item.csvData['正解3'],
          item.csvData['正解4'],
          item.csvData['正解5']
        ].filter(answer => answer && answer.trim() !== '');

        // 問題文に正解情報を追加
        let questionText = item.csvData['問題文'] || '';
        if (correctAnswers.length > 0) {
          questionText += '\n\n[提供された正解]:\n' + correctAnswers.map((ans, idx) => `正解${idx + 1}: ${ans}`).join('\n');
        }

        // ファイルがある場合のみBase64エンコード
        let base64Data: string | undefined = undefined;
        let mimeType: string | undefined = undefined;
        
        if (item.file) {
          base64Data = await fileToBase64(item.file);
          mimeType = item.file.type || (item.file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
        }

        const res = await fetch('/api/solve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: questionText,
            imageBase64: base64Data,
            mimeType: mimeType,
            model: model,
            customPrompt: systemPrompt
          }),
          signal: abortControllerRef.current?.signal
        });

        const data = await res.json();
        
        const answerText = res.ok ? data.answer : `Error: ${data.error}`;
        const hasIssue = answerText && (
          answerText.includes('【指摘事項】') || 
          answerText.includes('致命的') ||
          answerText.includes('解答不能')
        );
        
        setItems(prev => prev.map(p => p.id === item.id ? { 
          ...p, 
          status: res.ok ? 'completed' : 'error',
          answer: answerText,
          hasIssue: hasIssue
        } : p));

      } catch (error: any) {
        // 中止された場合はエラーとして記録しない
        if (error.name === 'AbortError') {
          setItems(prev => prev.map(p => p.id === item.id ? { 
            ...p, 
            status: 'waiting',
            answer: '',
            hasIssue: false
          } : p));
          break;
        }
        
        console.error(`Error processing item ${item.id}:`, error);
        const errorMsg = `System Error: ${error.message}`;
        const hasIssueError = errorMsg.includes('致命的');
        
        setItems(prev => prev.map(p => p.id === item.id ? { 
          ...p, 
          status: 'error',
          answer: errorMsg,
          hasIssue: hasIssueError
        } : p));
      }

      setProgress(prev => ({ ...prev, current: i + 1 }));
    }

    setProcessing(false);
    abortControllerRef.current = null; // クリーンアップ
    alert('一括チェックが完了しました');
  };

  const handleCancelBatch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleRecheck = async () => {
    // 完了済みまたはエラーのアイテムを待機中にリセット
    setItems(prev => prev.map(item => {
      if (item.status === 'completed' || item.status === 'error') {
        return { ...item, status: item.file ? 'waiting' : 'no_file', answer: '' };
      }
      return item;
    }));
    
    // リセット後、状態更新を待ってからチェックを開始
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 直接バッチ処理を開始(handleStartBatch内でアイテム取得するため)
    const targetItems = items.filter(item => 
      item.status === 'completed' || item.status === 'error'
    );
    
    if (targetItems.length === 0) {
      return; // 何もしない
    }

    setProcessing(true);
    setProgress({ current: 0, total: targetItems.length });
    abortControllerRef.current = new AbortController();

    // 直列処理ループ
    for (let i = 0; i < targetItems.length; i++) {
      // 中止チェック
      if (abortControllerRef.current?.signal.aborted) {
        setProcessing(false);
        alert(`処理を中止しました (${i}/${targetItems.length}件完了)`);
        return;
      }

      const item = targetItems[i];
      
      // ステータスを処理中に更新
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'processing' } : p));

      try {
        // CSVから正解を1～5を取得
        const correctAnswers = [
          item.csvData['正解1'],
          item.csvData['正解2'],
          item.csvData['正解3'],
          item.csvData['正解4'],
          item.csvData['正解5']
        ].filter(answer => answer && answer.trim() !== '');

        // 問題文に正解情報を追加
        let questionText = item.csvData['問題文'] || '';
        if (correctAnswers.length > 0) {
          questionText += '\n\n[提供された正解]:\n' + correctAnswers.map((ans, idx) => `正解${idx + 1}: ${ans}`).join('\n');
        }

        // ファイルがある場合のみBase64エンコード
        let base64Data: string | undefined = undefined;
        let mimeType: string | undefined = undefined;
        
        if (item.file) {
          base64Data = await fileToBase64(item.file);
          mimeType = item.file.type || (item.file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
        }

        const res = await fetch('/api/solve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: questionText,
            imageBase64: base64Data,
            mimeType: mimeType,
            model: model,
            customPrompt: systemPrompt
          }),
          signal: abortControllerRef.current?.signal
        });

        const data = await res.json();
        
        const answerText = res.ok ? data.answer : `Error: ${data.error}`;
        const hasIssue = answerText && (
          answerText.includes('【指摘事項】') || 
          answerText.includes('致命的') ||
          answerText.includes('解答不能')
        );
        
        setItems(prev => prev.map(p => p.id === item.id ? { 
          ...p, 
          status: res.ok ? 'completed' : 'error',
          answer: answerText,
          hasIssue: hasIssue
        } : p));

      } catch (error: any) {
        // 中止された場合はエラーとして記録しない
        if (error.name === 'AbortError') {
          setItems(prev => prev.map(p => p.id === item.id ? { 
            ...p, 
            status: 'waiting',
            answer: '',
            hasIssue: false
          } : p));
          break;
        }
        
        console.error(`Error processing item ${item.id}:`, error);
        const errorMsg = `System Error: ${error.message}`;
        const hasIssueError = errorMsg.includes('致命的');
        
        setItems(prev => prev.map(p => p.id === item.id ? { 
          ...p, 
          status: 'error',
          answer: errorMsg,
          hasIssue: hasIssueError
        } : p));
      }

      setProgress(prev => ({ ...prev, current: i + 1 }));
    }

    setProcessing(false);
    abortControllerRef.current = null;
    alert('一括チェックが完了しました');
  };

  const handleExportCsv = () => {
    // 結果を含むCSVを出力
    const csvContent = Papa.unparse(items.map(item => ({
      ...item.csvData,
      'ファイル名': item.fileName || '(なし)',
      'ステータス': item.status,
      'AI回答': item.answer
    })));

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `check_result_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearFiles = () => {
    if (processing) {
      alert('処理中はクリアできません');
      return;
    }
    if (confirm('すべてのファイルと結果をクリアしますか？')) {
      setCsvFile(null);
      setResourceFiles([]);
      setItems([]);
      setProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex items-center justify-between border-b border-gray-200 pb-4">
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            CSV一括チェックモード
          </h1>
          <div className="flex gap-2">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span>問題ごとにチェック</span>
            </Link>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="プロンプト設定"
            >
              <span>プロンプト設定</span>
              <Settings size={18} />
            </button>
            <button
              onClick={handleExportCsv}
              disabled={items.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              <Download size={16} /> 結果CSV出力
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6">
          {/* アップロードエリア */}
          <div 
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={handleDrop}
            className="bg-white p-8 rounded-xl shadow-sm border-2 border-dashed border-gray-300 hover:border-blue-500 transition-colors text-center"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-blue-50 rounded-full text-blue-600">
                <Upload size={32} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">ファイルをドラッグ＆ドロップ</h3>
                <p className="text-sm text-gray-500 mt-1">
                  CSVファイルと、対応する画像/PDFファイルをまとめてアップロードしてください
                </p>
              </div>
              <input 
                type="file" 
                multiple 
                onChange={handleFileSelect} 
                className="hidden" 
                id="batch-file-input" 
              />
              <label 
                htmlFor="batch-file-input"
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
              >
                ファイルを選択
              </label>
            </div>
            
            {/* ファイルステータス */}
            <div className="mt-6 flex justify-center gap-8 text-sm">
              <div className={`flex items-center gap-2 ${csvFile ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                <FileText size={18} />
                {csvFile ? csvFile.name : 'CSV未選択'}
              </div>
              <div className={`flex items-center gap-2 ${resourceFiles.length > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                <ImageIcon size={18} />
                リソースファイル: {resourceFiles.length}件
              </div>
            </div>
          </div>

          {/* コントロール & プログレス */}
          {items.length > 0 && (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-sm font-medium text-gray-700">
                  全 {items.length} 件中、
                  <span className="text-green-600 mx-1">{items.filter(i => i.status === 'waiting' || i.status === 'no_file').length}</span>
                  件が実行可能
                </div>
                {processing && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Loader2 size={16} className="animate-spin" />
                    処理中: {progress.current} / {progress.total}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClearFiles}
                  disabled={processing}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-red-200"
                  title="ファイルをクリア"
                >
                  <Trash2 size={16} />
                  <span>クリア</span>
                </button>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={processing}
                  className="p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white disabled:bg-gray-100"
                >
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (高精度)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (高速)</option>
                </select>
                {/* チェック開始 or 再チェックボタン */}
                {items.filter(i => i.status === 'waiting' || i.status === 'no_file').length === 0 && items.some(i => i.status === 'completed' || i.status === 'error') ? (
                  <button
                    onClick={handleRecheck}
                    disabled={processing}
                    className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-colors disabled:bg-gray-300"
                  >
                    <Play size={18} />
                    再チェック
                  </button>
                ) : (
                  <button
                    onClick={handleStartBatch}
                    disabled={processing || items.filter(i => i.status === 'waiting' || i.status === 'no_file').length === 0}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-white transition-colors
                      ${processing || items.filter(i => i.status === 'waiting' || i.status === 'no_file').length === 0
                        ? 'bg-gray-300 cursor-not-allowed' 
                        : 'bg-green-600 hover:bg-green-700 shadow-md'}`}
                  >
                    {processing ? '実行中...' : 'チェック開始'}
                    {!processing && <Play size={18} />}
                  </button>
                )}
                {processing && (
                  <button
                    onClick={handleCancelBatch}
                    className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 shadow-md transition-colors"
                  >
                    <StopCircle size={18} />
                    中止
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 結果テーブル */}
          {items.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 w-16">No.</th>
                      <th className="px-4 py-3 w-24">ステータス</th>
                      <th className="px-4 py-3 w-48">問題番号</th>
                      <th className="px-4 py-3 w-48">ファイル名</th>
                      <th className="px-4 py-3">
                        AI回答
                        <span className="ml-2 text-xs font-normal text-gray-500">（AIの出力は必ずしも正しいとは限りません）</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item) => (
                      <tr
                        key={item.id} 
                        style={{ backgroundColor: item.hasIssue ? '#fdf2f8' : '#ffffff' }}
                        className="hover:opacity-90"
                      >
                          <td className="px-4 py-3 text-gray-500">{item.id}</td>
                          <td className="px-4 py-3">
                            {item.status === 'waiting' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">待機中</span>}
                            {item.status === 'processing' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700"><Loader2 size={12} className="animate-spin mr-1"/>処理中</span>}
                            {item.status === 'completed' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700"><CheckCircle size={12} className="mr-1"/>完了</span>}
                            {item.status === 'error' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700"><AlertCircle size={12} className="mr-1"/>エラー</span>}
                            {item.status === 'no_file' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">ファイルなし</span>}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.key}</td>
                          <td className="px-4 py-3 text-gray-600 truncate max-w-[200px]" title={item.fileName || ''}>
                            {item.fileName || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="whitespace-pre-wrap text-xs text-gray-800">
                              {item.answer}
                            </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* プロンプト設定モーダル */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">プロンプト設定</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 mb-4">
                  AIに送信するシステムプロンプトをカスタマイズできます。この設定は全ユーザーに適用されます。
                </p>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full h-96 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm"
                  placeholder="システムプロンプトを入力してください..."
                />
                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    onClick={() => setShowSettings(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={saveSettings}
                    disabled={isSavingSettings}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:bg-gray-300 flex items-center gap-2"
                  >
                    {isSavingSettings ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        保存中...
                      </>
                    ) : (
                      '保存する'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
