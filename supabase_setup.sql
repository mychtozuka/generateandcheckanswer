-- Supabase Storageの設定用SQL
-- この内容をSupabaseダッシュボードの「SQL Editor」に貼り付けて実行（Run）してください。

-- 1. 'question-images' バケットをパブリック設定で作成
-- (既にバケットがある場合でも、設定を確実にするために実行して安全です)
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do update set public = true;

-- 2. アップロード許可ポリシー (誰でもアップロード可能)
-- 既存のポリシーがある場合はエラーになることがあるので、先に削除を試みます
drop policy if exists "Allow public uploads" on storage.objects;

create policy "Allow public uploads"
on storage.objects for insert
with check ( bucket_id = 'question-images' );

-- 3. 閲覧許可ポリシー (誰でも閲覧可能)
drop policy if exists "Allow public viewing" on storage.objects;

create policy "Allow public viewing"
on storage.objects for select
using ( bucket_id = 'question-images' );
