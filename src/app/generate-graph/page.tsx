// src/app/generate-graph/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

import { Download, Plus, Trash2, Eye, RefreshCw, Move, Circle, Triangle, PenLine } from 'lucide-react';

// グラフ要素の型定義
type GraphElement =
    | { type: 'function'; id: string; expression: string; color: string; }
    | { type: 'point'; id: string; x: number; y: number; label: string; color: string; }
    | { type: 'line'; id: string; x1: number; y1: number; x2: number; y2: number; color: string; }
    | { type: 'circle'; id: string; cx: number; cy: number; radius: number; color: string; }
    | { type: 'polygon'; id: string; points: { x: number; y: number }[]; color: string; fill: string; };

declare global {
    interface Window {
        JXG: any;
    }
}

export default function GenerateGraphPage() {
    const boardRef = useRef<HTMLDivElement>(null);
    const boardInstance = useRef<any>(null);

    // グラフ設定
    const [xMin, setXMin] = useState(-10);
    const [xMax, setXMax] = useState(10);
    const [yMin, setYMin] = useState(-10);
    const [yMax, setYMax] = useState(10);
    const [showGrid, setShowGrid] = useState(true);
    const [showAxis, setShowAxis] = useState(true);

    // 要素リスト
    const [elements, setElements] = useState<GraphElement[]>([]);

    // 新規要素追加用のフォーム
    const [newElementType, setNewElementType] = useState<'function' | 'point' | 'line' | 'circle' | 'polygon'>('function');
    const [newFunction, setNewFunction] = useState('x^2');
    const [newPointX, setNewPointX] = useState(0);
    const [newPointY, setNewPointY] = useState(0);
    const [newPointLabel, setNewPointLabel] = useState('A');
    const [newLineX1, setNewLineX1] = useState(0);
    const [newLineY1, setNewLineY1] = useState(0);
    const [newLineX2, setNewLineX2] = useState(2);
    const [newLineY2, setNewLineY2] = useState(2);
    const [newCircleCX, setNewCircleCX] = useState(0);
    const [newCircleCY, setNewCircleCY] = useState(0);
    const [newCircleRadius, setNewCircleRadius] = useState(3);
    const [newPolygonPoints, setNewPolygonPoints] = useState('0,0;3,0;1.5,2.5');
    const [newColor, setNewColor] = useState('#2563eb');
    const [newFillColor, setNewFillColor] = useState('#93c5fd');

    // JSXGraphのロード状態
    const [isScriptLoaded, setIsScriptLoaded] = useState(false);

    // JSXGraph読み込み
    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (window.JXG) {
                setIsScriptLoaded(true);
                return;
            }
            if (document.querySelector('script[src*="jsxgraphcore.js"]')) {
                const interval = setInterval(() => {
                    if (window.JXG) {
                        setIsScriptLoaded(true);
                        clearInterval(interval);
                    }
                }, 100);
                return;
            }
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraph.css';
            document.head.appendChild(link);
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraphcore.js';
            script.async = true;
            script.onload = () => {
                setIsScriptLoaded(true);
            };
            document.body.appendChild(script);
        }
    }, []);

    // ボード初期化と管理
    useEffect(() => {
        if (!isScriptLoaded || !boardRef.current || !window.JXG) return;

        console.log("Initialize board...");

        // コンテナのクリア (念のため)
        while (boardRef.current.firstChild) {
            boardRef.current.removeChild(boardRef.current.firstChild);
        }

        // 新しいボード用DIVを作成 (DOM再生成戦略)
        const boardDiv = document.createElement('div');
        boardDiv.id = 'jxgbox-graph-' + Math.random().toString(36).substr(2, 9);
        boardDiv.className = 'w-full h-full'; // サイズを親に合わせる
        // JSXGraphのスタイル適用のためにクラスを追加 (必要に応じて)
        boardDiv.classList.add('jxgbox');

        boardRef.current.appendChild(boardDiv);

        const boardId = boardDiv.id;

        // ボード作成
        let board: any;
        try {
            board = window.JXG.JSXGraph.initBoard(boardId, {
                boundingbox: [xMin, yMax, xMax, yMin],
                showCopyright: false,
                showNavigation: false,
                keepAspectRatio: false,
                axis: false,
                defaultAxes: { x: { visible: false }, y: { visible: false } }, // 強制的にデフォルト軸を無効化
                parsing: false,
            });
            boardInstance.current = board;
        } catch (e) {
            console.error("Board init error:", e);
            // 失敗したらDIVも掃除
            if (boardRef.current.contains(boardDiv)) {
                boardRef.current.removeChild(boardDiv);
            }
            return;
        }

        // グリッド
        if (showGrid) {
            // グリッドを描画
            board.create('grid', [], {
                gridX: 1, gridY: 1,
                strokeColor: '#e5e7eb', strokeWidth: 1, strokeOpacity: 0.8,
                isSystem: true
            });
        }

        // 軸
        if (showAxis) {
            // X軸
            board.create('axis', [[0, 0], [1, 0]], {
                name: 'x',
                withLabel: true,
                label: { position: 'rt', offset: [-10, 15] },
                strokeColor: '#374151',
                strokeWidth: 2,
                ticks: { strokeColor: '#374151' },
                isSystem: true
            });
            // Y軸
            board.create('axis', [[0, 0], [0, 1]], {
                name: 'y',
                withLabel: true,
                label: { position: 'rt', offset: [15, -5] },
                strokeColor: '#374151',
                strokeWidth: 2,
                ticks: { strokeColor: '#374151' },
                isSystem: true
            });
        }

        // ユーザー要素の描画
        elements.forEach((el) => {
            try {
                const commonProps = { strokeColor: el.color, strokeWidth: 2, fillColor: 'transparent' };
                if (el.type === 'function') {
                    board.create('functiongraph', [(x: any) => {
                        try {
                            const scope = { x: x, sin: Math.sin, cos: Math.cos, tan: Math.tan, abs: Math.abs, sqrt: Math.sqrt, log: Math.log, exp: Math.exp, pi: Math.PI, PI: Math.PI };
                            // 安全性の低いevalの代わりにFunctionを使用すべきだが、簡易実装のため数式変換
                            const expr = el.expression.replace(/\^/g, '**');
                            // 簡易的な評価
                            return new Function('x', 'with(Math){ return ' + expr + '}')(x);
                        } catch { return NaN; }
                    }, xMin, xMax], commonProps);
                } else if (el.type === 'point') {
                    board.create('point', [el.x, el.y], { name: el.label, size: 4, fillColor: el.color, strokeColor: el.color });
                } else if (el.type === 'line') {
                    board.create('line', [[el.x1, el.y1], [el.x2, el.y2]], { ...commonProps, straightFirst: false, straightLast: false });
                } else if (el.type === 'circle') {
                    board.create('circle', [[el.cx, el.cy], el.radius], commonProps);
                } else if (el.type === 'polygon') {
                    const pts = el.points.map(p => [p.x, p.y]);
                    board.create('polygon', pts, { ...commonProps, fillColor: el.fill, fillOpacity: 0.3, borders: commonProps });
                }
            } catch (err) {
                console.error("Render element error:", err);
            }
        });

        // クリーンアップ関数
        return () => {
            if (board) {
                try { window.JXG.JSXGraph.freeBoard(board); } catch (e) { }
            }
            if (boardRef.current && boardDiv && boardRef.current.contains(boardDiv)) {
                try { boardRef.current.removeChild(boardDiv); } catch (e) { }
            }
            boardInstance.current = null;
        };

    }, [isScriptLoaded, xMin, xMax, yMin, yMax, showGrid, showAxis, elements]); // 全ての依存関係を含める

    // 古い関数を削除（useEffectに統合したため）
    const initBoard = useCallback(() => { }, []);
    const renderElements = useCallback(() => { }, []);

    // 要素追加
    const addElement = () => {
        const id = `el-${Date.now()}`;
        let newEl: GraphElement;

        switch (newElementType) {
            case 'function':
                newEl = { type: 'function', id, expression: newFunction, color: newColor };
                break;
            case 'point':
                newEl = { type: 'point', id, x: newPointX, y: newPointY, label: newPointLabel, color: newColor };
                break;
            case 'line':
                newEl = { type: 'line', id, x1: newLineX1, y1: newLineY1, x2: newLineX2, y2: newLineY2, color: newColor };
                break;
            case 'circle':
                newEl = { type: 'circle', id, cx: newCircleCX, cy: newCircleCY, radius: newCircleRadius, color: newColor };
                break;
            case 'polygon':
                const pts = newPolygonPoints.split(';').map((p) => {
                    const [x, y] = p.split(',').map(Number);
                    return { x, y };
                });
                newEl = { type: 'polygon', id, points: pts, color: newColor, fill: newFillColor };
                break;
            default:
                return;
        }

        setElements([...elements, newEl]);
    };

    // 要素削除
    const removeElement = (id: string) => {
        setElements(elements.filter((el) => el.id !== id));
    };

    // 画像ダウンロード
    const downloadImage = () => {
        if (!boardRef.current) return;

        const svg = boardRef.current.querySelector('svg');
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        canvas.width = 800;
        canvas.height = 800;

        img.onload = () => {
            if (ctx) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const a = document.createElement('a');
                a.download = `graph-${Date.now()}.png`;
                a.href = canvas.toDataURL('image/png');
                a.click();
            }
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 p-8">
            <div className="max-w-7xl mx-auto">
                {/* ヘッダー */}
                <header className="mb-8 flex items-center justify-between border-b border-gray-200 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-600 p-2 rounded-lg text-white">
                            <PenLine size={24} strokeWidth={3} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                                グラフ・図形生成
                            </h1>
                            <p className="text-xs text-gray-500 font-medium">
                                関数グラフ・点・図形を正確に描画
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={downloadImage}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                        <Download size={18} />
                        画像ダウンロード
                    </button>
                </header>

                {/* ナビゲーション */}


                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 左: 設定パネル */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
                        <h2 className="text-lg font-semibold border-b pb-2">座標設定</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-600">X最小</label>
                                <input type="number" value={xMin} onChange={(e) => setXMin(Number(e.target.value))}
                                    className="w-full p-2 border rounded mt-1" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-600">X最大</label>
                                <input type="number" value={xMax} onChange={(e) => setXMax(Number(e.target.value))}
                                    className="w-full p-2 border rounded mt-1" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-600">Y最小</label>
                                <input type="number" value={yMin} onChange={(e) => setYMin(Number(e.target.value))}
                                    className="w-full p-2 border rounded mt-1" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-600">Y最大</label>
                                <input type="number" value={yMax} onChange={(e) => setYMax(Number(e.target.value))}
                                    className="w-full p-2 border rounded mt-1" />
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
                                <span className="text-sm">グリッド</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={showAxis} onChange={(e) => setShowAxis(e.target.checked)} />
                                <span className="text-sm">軸</span>
                            </label>
                        </div>

                        <h2 className="text-lg font-semibold border-b pb-2 pt-4">要素追加</h2>
                        <div className="space-y-4">
                            <select value={newElementType} onChange={(e) => setNewElementType(e.target.value as any)}
                                className="w-full p-2 border rounded">
                                <option value="function">関数</option>
                                <option value="point">点</option>
                                <option value="line">線分</option>
                                <option value="circle">円</option>
                                <option value="polygon">多角形</option>
                            </select>

                            {newElementType === 'function' && (
                                <div>
                                    <label className="text-sm font-medium text-gray-600">y = </label>
                                    <input type="text" value={newFunction} onChange={(e) => setNewFunction(e.target.value)}
                                        className="w-full p-2 border rounded mt-1" placeholder="x^2, sin(x), 2*x+1" />
                                    <p className="text-xs text-gray-400 mt-1">使用可能: ^(累乗), sin, cos, tan, sqrt, abs, log, pi</p>
                                </div>
                            )}

                            {newElementType === 'point' && (
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-xs">X</label>
                                        <input type="number" value={newPointX} onChange={(e) => setNewPointX(Number(e.target.value))}
                                            className="w-full p-2 border rounded" />
                                    </div>
                                    <div>
                                        <label className="text-xs">Y</label>
                                        <input type="number" value={newPointY} onChange={(e) => setNewPointY(Number(e.target.value))}
                                            className="w-full p-2 border rounded" />
                                    </div>
                                    <div>
                                        <label className="text-xs">ラベル</label>
                                        <input type="text" value={newPointLabel} onChange={(e) => setNewPointLabel(e.target.value)}
                                            className="w-full p-2 border rounded" />
                                    </div>
                                </div>
                            )}

                            {newElementType === 'line' && (
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="number" value={newLineX1} onChange={(e) => setNewLineX1(Number(e.target.value))}
                                        className="p-2 border rounded" placeholder="X1" />
                                    <input type="number" value={newLineY1} onChange={(e) => setNewLineY1(Number(e.target.value))}
                                        className="p-2 border rounded" placeholder="Y1" />
                                    <input type="number" value={newLineX2} onChange={(e) => setNewLineX2(Number(e.target.value))}
                                        className="p-2 border rounded" placeholder="X2" />
                                    <input type="number" value={newLineY2} onChange={(e) => setNewLineY2(Number(e.target.value))}
                                        className="p-2 border rounded" placeholder="Y2" />
                                </div>
                            )}

                            {newElementType === 'circle' && (
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-xs">中心X</label>
                                        <input type="number" value={newCircleCX} onChange={(e) => setNewCircleCX(Number(e.target.value))}
                                            className="w-full p-2 border rounded" />
                                    </div>
                                    <div>
                                        <label className="text-xs">中心Y</label>
                                        <input type="number" value={newCircleCY} onChange={(e) => setNewCircleCY(Number(e.target.value))}
                                            className="w-full p-2 border rounded" />
                                    </div>
                                    <div>
                                        <label className="text-xs">半径</label>
                                        <input type="number" value={newCircleRadius} onChange={(e) => setNewCircleRadius(Number(e.target.value))}
                                            className="w-full p-2 border rounded" />
                                    </div>
                                </div>
                            )}

                            {newElementType === 'polygon' && (
                                <div>
                                    <label className="text-xs">頂点 (x,y;x,y;...)</label>
                                    <input type="text" value={newPolygonPoints} onChange={(e) => setNewPolygonPoints(e.target.value)}
                                        className="w-full p-2 border rounded mt-1" placeholder="0,0;3,0;1.5,2.5" />
                                    <div className="mt-2">
                                        <label className="text-xs">塗りつぶし色</label>
                                        <input type="color" value={newFillColor} onChange={(e) => setNewFillColor(e.target.value)}
                                            className="w-full h-8 border rounded cursor-pointer" />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-xs">線の色</label>
                                <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
                                    className="w-full h-8 border rounded cursor-pointer" />
                            </div>

                            <button onClick={addElement}
                                className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2">
                                <Plus size={18} /> 追加
                            </button>
                        </div>

                        {/* 要素リスト */}
                        <h2 className="text-lg font-semibold border-b pb-2 pt-4">追加済み要素</h2>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {elements.length === 0 ? (
                                <p className="text-sm text-gray-400">要素がありません</p>
                            ) : (
                                elements.map((el) => (
                                    <div key={el.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                                        <span className="text-sm">
                                            {el.type === 'function' && `y = ${el.expression}`}
                                            {el.type === 'point' && `点 ${el.label} (${el.x}, ${el.y})`}
                                            {el.type === 'line' && `線分 (${el.x1},${el.y1})-(${el.x2},${el.y2})`}
                                            {el.type === 'circle' && `円 中心(${el.cx},${el.cy}) r=${el.radius}`}
                                            {el.type === 'polygon' && `多角形 ${el.points.length}頂点`}
                                        </span>
                                        <button onClick={() => removeElement(el.id)} className="text-red-500 hover:text-red-700">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 右: グラフ表示 */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div
                            ref={boardRef}
                            id="jxgbox"
                            className="w-full aspect-square border border-gray-200 rounded-lg"
                            style={{ minHeight: '500px' }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
