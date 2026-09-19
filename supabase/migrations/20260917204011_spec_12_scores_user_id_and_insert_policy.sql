alter table public.scores
  add column user_id uuid references auth.users(id) on delete set null default auth.uid();

drop policy "anyone can insert a score" on public.scores;

create policy "authenticated users can insert their own score"
  on public.scores
  for insert
  with check (auth.uid() is not null and user_id = auth.uid());
