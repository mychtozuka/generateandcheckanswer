'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Papa from 'papaparse';
import { Upload, FileText, Image as ImageIcon, Play, Loader2, CheckCircle, AlertCircle, Download, Settings, X, StopCircle, Trash2 } from 'lucide-react';

// モデル定数の定義
const MODEL_FLASH = 'gemini-2.5-flash'; // ユーザー選択用（高速）
const MODEL_PRO = 'gemini-2.5-pro'; // ユーザー選択用（高精度）
const MODEL_VERIFIER = 'gemini-3-pro-preview'; // 再検証用最強モデル

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
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showMasterTemplateModal, setShowMasterTemplateModal] = useState(false);
  const [model, setModel] = useState(MODEL_FLASH);
  const abortControllerRef = useRef<AbortController | null>(null);

  // デバッグ用: resourceFiles の変更を監視
  useEffect(() => {
    console.log(`resourceFiles state 更新: ${resourceFiles.length}個`, resourceFiles.map(f => f.name));
  }, [resourceFiles]);

  // サーバーからプロンプト設定を読み込む
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

  // ディレクトリを再帰的にスキャンするヘルパー関数
  const scanEntry = (entry: any): Promise<File[]> => {
    return new Promise((resolve) => {
      if (entry.isFile) {
        entry.file((file: File) => {
          resolve([file]);
        }, (err: any) => {
          console.warn('File read error:', err);
          resolve([]);
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const allFiles: File[] = [];
        
        const readEntries = () => {
          dirReader.readEntries(async (entries: any[]) => {
            if (entries.length === 0) {
              resolve(allFiles);
            } else {
              const filesFromEntries = await Promise.all(entries.map(scanEntry));
              allFiles.push(...filesFromEntries.flat());
              readEntries(); // Continue reading until empty
            }
          }, (err: any) => {
             console.warn('Directory read error:', err);
             resolve(allFiles);
          });
        };
        readEntries();
      } else {
        resolve([]);
      }
    });
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('=== handleDrop 呼び出し ===');
    
    const files: File[] = [];
    
    // items プロパティを優先して使用 (フォルダ対応)
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      console.log(`items detected: ${e.dataTransfer.items.length}`);
      const entries: any[] = [];
      
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === 'file') {
          // webkitGetAsEntry は非標準だが主要ブラウザでサポート
          const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
          if (entry) {
            entries.push(entry);
          } else {
            // フォールバック
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
      }

      if (entries.length > 0) {
        console.log(`Processing ${entries.length} entries recursively...`);
        const recursiveFiles = await Promise.all(entries.map(scanEntry));
        files.push(...recursiveFiles.flat());
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // フォールバック
      console.log(`files detected: ${e.dataTransfer.files.length}`);
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        files.push(e.dataTransfer.files[i]);
      }
    }

    if (files.length > 0) {
      console.log(`✅ ドロップされたファイル数 (展開後): ${files.length}`);
      processFiles(files);
    } else {
      console.log('❌ ドロップされたファイルがありません');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleFileSelect 呼び出し');
    console.log('e.target.files:', e.target.files);
    console.log('e.target.files?.length:', e.target.files?.length);
    
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      console.log(`✅ 選択されたファイル数: ${filesArray.length}`);
      console.log('ファイル名一覧:', filesArray.map(f => f.name));
      processFiles(filesArray);
      // input要素をリセット（同じファイルを再選択可能にする）
      e.target.value = '';
    } else {
      console.log('❌ ファイルが選択されていません');
    }
  };

  const processFiles = (files: File[]) => {
    console.log('=== processFiles 開始 ===');
    console.log(`受け取ったファイル数: ${files.length}`);
    console.log('ファイル一覧:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    
    const newCsv = files.find(f => f.name.endsWith('.csv'));
    const newResources = files.filter(f => !f.name.endsWith('.csv'));

    console.log(`CSV: ${newCsv?.name || 'なし'}`);
    console.log(`新規リソース: ${newResources.length}個`);
    console.log(`既存リソース: ${resourceFiles.length}個`);

    let updatedResources = [...resourceFiles];
    if (newResources.length > 0) {
      // 重複排除: 同名のファイルは新しいもので上書き
      const resourceMap = new Map(resourceFiles.map(f => [f.name, f]));
      newResources.forEach(f => resourceMap.set(f.name, f));
      updatedResources = Array.from(resourceMap.values());

      console.log(`結合後のリソース: ${updatedResources.length}個`);
      setResourceFiles(updatedResources);
      console.log('✅ setResourceFiles 実行完了');
    }

    if (newCsv) {
      setCsvFile(newCsv);
      parseCsv(newCsv, updatedResources);
    } else if (csvFile && newResources.length > 0) {
      // CSVが既に読み込まれていれば再マッチング
      console.log('既存CSVで再マッチング実行');
      parseCsv(csvFile, updatedResources);
    }
    console.log('=== processFiles 終了 ===');
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

        // 正解データを文字列化（なければ「(未登録)」）
        const correctAnswerText = correctAnswers.length > 0 
          ? correctAnswers.map((ans, idx) => `正解${idx + 1}: ${ans}`).join('\n')
          : '(未登録)';

        const questionText = item.csvData['問題文'] || '';

        // ファイルがある場合のみBase64エンコード
        let base64Data: string | undefined = undefined;
        let mimeType: string | undefined = undefined;
        
        if (item.file) {
          base64Data = await fileToBase64(item.file);
          mimeType = item.file.type || (item.file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
        }

        // リトライロジック（504エラー対策）
        let answerText = '';
        let hasIssue = false;
        let retryCount = 0;
        const maxRetries = 2;
        let lastError = null;

        while (retryCount <= maxRetries) {
          try {
            const res = await fetch('/api/solve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: questionText,
                correctAnswer: correctAnswerText,
                imageBase64: base64Data,
                mimeType: mimeType,
                model: model,
                customPrompt: systemPrompt
              }),
              signal: abortControllerRef.current?.signal
            });

            // 認証エラーチェック
            if (res.status === 401 || res.status === 403) {
              throw new Error('認証エラー: ページを再読み込みしてください');
            }

            // 504エラーの場合はリトライ
            if (res.status === 504 && retryCount < maxRetries) {
              console.log(`504エラー発生 (試行 ${retryCount + 1}/${maxRetries + 1}): ${item.key} - 再試行します`);
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 3000)); // 3秒待機
              continue;
            }

            // JSON解析エラーの対策
            try {
              const data = await res.json();
              answerText = res.ok ? data.answer : `Error: ${data.error || 'APIエラー'}`;
            } catch (jsonError) {
              // JSON解析に失敗した場合（HTMLエラーページが返された場合など）
              console.error('JSON解析エラー (handleStartBatch):', jsonError);
              answerText = `サーバーエラー: レスポンスの解析に失敗しました (ステータス: ${res.status})`;
              
              // 504の場合はリトライ
              if (res.status === 504 && retryCount < maxRetries) {
                console.log(`504エラー (JSON解析失敗) - 再試行 ${retryCount + 1}/${maxRetries + 1}`);
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 3000));
                continue;
              }
            }
            
            hasIssue = answerText && (
              answerText.includes('【指摘事項】') || 
              answerText.includes('致命的') ||
              answerText.includes('解答不能')
            );

            // 成功したらループを抜ける
            break;

          } catch (fetchError: any) {
            lastError = fetchError;
            if (fetchError.name === 'AbortError') {
              throw fetchError; // 中止エラーはそのまま投げる
            }
            
            if (retryCount < maxRetries) {
              console.log(`ネットワークエラー発生 (試行 ${retryCount + 1}/${maxRetries + 1}): ${fetchError.message} - 再試行します`);
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 3000));
              continue;
            } else {
              answerText = `ネットワークエラー: ${fetchError.message}`;
              break;
            }
          }
        }

        // 図表付きで不備がある場合は、gemini-3-proを使って再検証
        if (hasIssue && base64Data && model !== MODEL_VERIFIER) {
          console.log(`図表付き問題で不備検出: ${item.key} - ${MODEL_VERIFIER}で再検証します`);
          
          try {
            const recheckRes = await fetch('/api/solve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: questionText,
                correctAnswer: correctAnswerText,
                imageBase64: base64Data,
                mimeType: mimeType,
                model: MODEL_VERIFIER,
                customPrompt: systemPrompt
              }),
              signal: abortControllerRef.current?.signal
            });

            if (recheckRes.ok) {
              const recheckData = await recheckRes.json();
              answerText = `[${MODEL_VERIFIER}で再検証]\n${recheckData.answer}`;
            }
          } catch (recheckError) {
            console.error(`${MODEL_VERIFIER}での再検証に失敗:`, recheckError);
            // 元の結果を維持
          }
        }
        
        setItems(prev => prev.map(p => p.id === item.id ? { 
          ...p, 
          status: res.ok ? 'completed' : 'error',
          answer: answerText,
          hasIssue: hasIssue
        } : p));

        // Supabaseに結果を保存（非同期で実行し、エラーは無視）
        try {
          await fetch('/api/batch-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              result: {
                key: item.key,
                fileName: item.fileName,
                csvData: item.csvData,
                answer: answerText,
                hasIssue: hasIssue,
                status: res.ok ? 'completed' : 'error'
              }
            })
          });
        } catch (dbError) {
          console.error('DB保存エラー（処理は継続）:', dbError);
        }

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

        // 正解データを文字列化（なければ「(未登録)」）
        const correctAnswerText = correctAnswers.length > 0 
          ? correctAnswers.map((ans, idx) => `正解${idx + 1}: ${ans}`).join('\n')
          : '(未登録)';

        const questionText = item.csvData['問題文'] || '';

        // ファイルがある場合のみBase64エンコード
        let base64Data: string | undefined = undefined;
        let mimeType: string | undefined = undefined;
        
        if (item.file) {
          base64Data = await fileToBase64(item.file);
          mimeType = item.file.type || (item.file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
        }

        // リトライロジック（504エラー対策）
        let answerText = '';
        let hasIssue = false;
        let retryCount = 0;
        const maxRetries = 2;
        let lastError = null;

        while (retryCount <= maxRetries) {
          try {
            const res = await fetch('/api/solve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: questionText,
                correctAnswer: correctAnswerText,
                imageBase64: base64Data,
                mimeType: mimeType,
                model: model,
                customPrompt: systemPrompt
              }),
              signal: abortControllerRef.current?.signal
            });

            // 認証エラーチェック
            if (res.status === 401 || res.status === 403) {
              throw new Error('認証エラー: ページを再読み込みしてください');
            }

            // 504エラーの場合はリトライ
            if (res.status === 504 && retryCount < maxRetries) {
              console.log(`504エラー発生 (再チェック - 試行 ${retryCount + 1}/${maxRetries + 1}): ${item.key} - 再試行します`);
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 3000)); // 3秒待機
              continue;
            }

            // JSON解析エラーの対策
            try {
              const data = await res.json();
              answerText = res.ok ? data.answer : `Error: ${data.error || 'APIエラー'}`;
            } catch (jsonError) {
              // JSON解析に失敗した場合（HTMLエラーページが返された場合など）
              console.error('JSON解析エラー (handleRecheck):', jsonError);
              answerText = `サーバーエラー: レスポンスの解析に失敗しました (ステータス: ${res.status})`;
              
              // 504の場合はリトライ
              if (res.status === 504 && retryCount < maxRetries) {
                console.log(`504エラー (JSON解析失敗) - 再試行 ${retryCount + 1}/${maxRetries + 1}`);
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 3000));
                continue;
              }
            }
            
            hasIssue = answerText && (
              answerText.includes('【指摘事項】') || 
              answerText.includes('致命的') ||
              answerText.includes('解答不能')
            );

            // 成功したらループを抜ける
            break;

          } catch (fetchError: any) {
            lastError = fetchError;
            if (fetchError.name === 'AbortError') {
              throw fetchError; // 中止エラーはそのまま投げる
            }
            
            if (retryCount < maxRetries) {
              console.log(`ネットワークエラー発生 (再チェック - 試行 ${retryCount + 1}/${maxRetries + 1}): ${fetchError.message} - 再試行します`);
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 3000));
              continue;
            } else {
              answerText = `ネットワークエラー: ${fetchError.message}`;
              break;
            }
          }
        }

        // 図表付きで不備がある場合は、gemini-3-proを使って再検証
        if (hasIssue && base64Data && model !== MODEL_VERIFIER) {
          console.log(`図表付き問題で不備検出 (再チェック): ${item.key} - ${MODEL_VERIFIER}で再検証します`);
          
          try {
            const recheckRes = await fetch('/api/solve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: questionText,
                correctAnswer: correctAnswerText,
                imageBase64: base64Data,
                mimeType: mimeType,
                model: MODEL_VERIFIER,
                customPrompt: systemPrompt
              }),
              signal: abortControllerRef.current?.signal
            });

            if (recheckRes.ok) {
              const recheckData = await recheckRes.json();
              answerText = `[${MODEL_VERIFIER}で再検証]\n${recheckData.answer}`;
            }
          } catch (recheckError) {
            console.error(`${MODEL_VERIFIER}での再検証に失敗:`, recheckError);
            // 元の結果を維持
          }
        }
        
        setItems(prev => prev.map(p => p.id === item.id ? { 
          ...p, 
          status: res.ok ? 'completed' : 'error',
          answer: answerText,
          hasIssue: hasIssue
        } : p));

        // Supabaseに結果を保存（非同期で実行し、エラーは無視）
        try {
          await fetch('/api/batch-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              result: {
                key: item.key,
                fileName: item.fileName,
                csvData: item.csvData,
                answer: answerText,
                hasIssue: hasIssue,
                status: res.ok ? 'completed' : 'error'
              }
            })
          });
        } catch (dbError) {
          console.error('DB保存エラー（処理は継続）:', dbError);
        }

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
                accept=".csv,.pdf,.png,.jpg,.jpeg,.gif,.bmp,.webp"
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
                  <option value={MODEL_PRO}>Gemini 2.5 Pro (高精度)</option>
                  <option value={MODEL_FLASH}>Gemini 2.5 Flash (高速)</option>
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
                <div className="mt-6 flex justify-between">
                  <button
                    onClick={() => setShowMasterTemplateModal(true)}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-300"
                  >
                    マスターテンプレート表示
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSystemPrompt(originalPrompt);
                        setShowSettings(false);
                      }}
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
          </div>
        )}

        {/* マスターテンプレート表示モーダル */}
        {showMasterTemplateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">マスターテンプレート（参照用）</h2>
                <button
                  onClick={() => setShowMasterTemplateModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 mb-4">
                  これはマスターテンプレートです。参照用として表示しています。
                </p>
                <textarea
                  value={MASTER_TEMPLATE}
                  readOnly
                  className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-sm bg-gray-50"
                />
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowMasterTemplateModal(false)}
                    className="px-6 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
                  >
                    閉じる
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
