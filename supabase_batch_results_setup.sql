-- Supabase用テーブル作成SQL
-- batch_check_resultsテーブル: バッチチェック結果を保存

CREATE TABLE IF NOT EXISTS batch_check_results (
  id BIGSERIAL PRIMARY KEY,
  problem_key TEXT NOT NULL,
  grade TEXT,
  subject TEXT,
  section TEXT,
  unit TEXT,
  difficulty TEXT,
  check_number TEXT,
  test_number TEXT,
  file_name TEXT,
  question_text TEXT,
  correct_answer_1 TEXT,
  correct_answer_2 TEXT,
  correct_answer_3 TEXT,
  correct_answer_4 TEXT,
  correct_answer_5 TEXT,
  ai_answer TEXT,
  has_issue BOOLEAN DEFAULT FALSE,
  status TEXT,
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_batch_results_problem_key ON batch_check_results(problem_key);
CREATE INDEX IF NOT EXISTS idx_batch_results_has_issue ON batch_check_results(has_issue);
CREATE INDEX IF NOT EXISTS idx_batch_results_checked_at ON batch_check_results(checked_at);
CREATE INDEX IF NOT EXISTS idx_batch_results_grade_subject ON batch_check_results(grade, subject);

-- コメント追加
COMMENT ON TABLE batch_check_results IS 'CSV一括チェックの結果を保存';
COMMENT ON COLUMN batch_check_results.problem_key IS '問題キー（学年-教科-節-単元-難易度-チェックナンバー-テストナンバー）';
COMMENT ON COLUMN batch_check_results.has_issue IS '不備フラグ（true=不備あり）';
COMMENT ON COLUMN batch_check_results.status IS 'チェックステータス（completed/error）';
COMMENT ON COLUMN batch_check_results.checked_at IS 'チェック実行日時';
