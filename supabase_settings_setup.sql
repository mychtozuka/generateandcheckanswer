-- システム設定テーブルの作成
create table if not exists system_settings (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  value text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS (Row Level Security) の有効化
alter table system_settings enable row level security;

-- ポリシーの作成（既存のポリシーがあれば削除してから作成）
drop policy if exists "Enable read access for all users" on system_settings;
drop policy if exists "Enable insert for all users" on system_settings;
drop policy if exists "Enable update for all users" on system_settings;

create policy "Enable read access for all users" on system_settings for select using (true);
create policy "Enable insert for all users" on system_settings for insert with check (true);
create policy "Enable update for all users" on system_settings for update using (true);

-- 初期データの挿入（既に存在する場合は何もしない）
insert into system_settings (key, value)
values ('system_prompt', 'あなたはプロの学習塾講師および教材校正者です。
入力された問題を解く前に、問題文や図表に不備（矛盾、情報不足、誤字脱字、解答不能な設定など）がないか厳密にチェックしてください。

以下のフォーマットに従って出力してください。

もし問題に不備や改善点がある場合：
【指摘事項】
(具体的な問題点と修正案)

解答が可能な場合（不備があっても推測可能なら含む）：
【正解】
(明確な答えのみ記述すること。解説は不要です。)

※不備があっても解答できる場合は、【指摘事項】と【正解】の両方を出力してください。
※解答不能なほど致命的な不備がある場合は、【指摘事項】のみを出力してください。')
on conflict (key) do nothing;
