insert into public.sports(id,name,icon) values
('badminton','Badminton','fitness-outline'),
('baseball','Baseball','fitness-outline'),
('cricket','Cricket','fitness-outline'),
('dodgeball','Dodgeball','fitness-outline'),
('flag-football','Flag football','fitness-outline'),
('futsal','Futsal','fitness-outline'),
('handball','Handball','fitness-outline'),
('field-hockey','Field hockey','fitness-outline'),
('ice-hockey','Ice hockey','fitness-outline'),
('kickball','Kickball','fitness-outline'),
('lacrosse','Lacrosse','fitness-outline'),
('netball','Netball','fitness-outline'),
('padel','Padel','fitness-outline'),
('pickleball','Pickleball','fitness-outline'),
('rounders','Rounders','fitness-outline'),
('rugby','Rugby','fitness-outline'),
('softball','Softball','fitness-outline'),
('squash','Squash','fitness-outline'),
('table-tennis','Table tennis','fitness-outline'),
('ultimate','Ultimate frisbee','fitness-outline')
on conflict (id) do nothing;

-- Validate against the catalog so new sports never require a new profile constraint.
alter table public.profiles drop constraint known_sports;
create function public.validate_profile_sports() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if exists (select 1 from unnest(new.sports) as selected(id)
    where not exists (select 1 from public.sports s where s.id = selected.id)) then
    raise exception 'Choose sports from the sports catalog';
  end if;
  return new;
end $$;
revoke all on function public.validate_profile_sports() from public,anon,authenticated;
create trigger validate_profile_sports before insert or update of sports
on public.profiles for each row execute function public.validate_profile_sports();
