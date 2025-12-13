"use client";

import React, { useState } from "react";

export default function GenerateQuestion(): React.ReactElement {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("normal");
  const [question, setQuestion] = useState("");

  function generate() {
    const t = topic.trim() || "一般的なトピック";
    let q = "";
    if (difficulty === "easy") {
      q = `${t} に関する基礎的な設問を1つ作ってください。選択肢は不要で、短い答えが求められます。`;
    } else if (difficulty === "hard") {
      q = `${t} に関する高度な設問を1つ作ってください。詳細な解説が必要な記述式の問いにしてください。`;
    } else {
      q = `${t} に関する標準的な設問を1つ作ってください。解答は簡潔にまとめられます。`;
    }
    setQuestion(q);
  }

  return (
    <div style={{ maxWidth: 820, margin: "2rem auto", padding: "1rem" }}>
      <h1 style={{ marginBottom: "0.75rem" }}>GenerateQuestion</h1>

      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        トピック
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="例: JavaScript の配列操作"
          style={{ display: "block", width: "100%", marginTop: 6, padding: 8 }}
        />
      </label>

      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        難易度
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          style={{ display: "block", marginTop: 6, padding: 8 }}
        >
          <option value="easy">Easy</option>
          <option value="normal">Normal</option>
          <option value="hard">Hard</option>
        </select>
      </label>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={generate} style={{ padding: "8px 12px" }}>
          問題生成
        </button>
        <button
          onClick={() => {
            setTopic("");
            setDifficulty("normal");
            setQuestion("");
          }}
          style={{ padding: "8px 12px" }}
        >
          リセット
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={{ display: "block", marginBottom: 6 }}>生成された設問</label>
        <textarea
          readOnly
          value={question}
          rows={6}
          style={{ width: "100%", padding: 8 }}
        />
      </div>
    </div>
  );
}
