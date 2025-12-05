'use client';

import { useEffect } from 'react';

/**
 * Basic認証のセッションを維持するコンポーネント
 * 5分ごとにダミーリクエストを送信して認証状態を保持
 */
export default function AuthKeepAlive() {
  useEffect(() => {
    // 5分ごとにpingを送信
    const interval = setInterval(async () => {
      try {
        // 軽量なAPIエンドポイントにリクエストを送信
        await fetch('/api/ping', { 
          method: 'GET',
          credentials: 'same-origin' // 認証情報を含める
        });
        console.log('認証状態を維持しました');
      } catch (error) {
        console.error('認証状態の維持に失敗:', error);
      }
    }, 5 * 60 * 1000); // 5分 = 300,000ms

    return () => clearInterval(interval);
  }, []);

  return null; // UIは表示しない
}
