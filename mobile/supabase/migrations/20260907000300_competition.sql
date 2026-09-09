create function public.create_tournament(payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();lid uuid;tid uuid;begin
 if (select count(*) from tournaments where organizer_id=u and starts_at>now())>=3 then raise exception 'Manage your existing tournaments first';end if;
 if (payload->>'registration_deadline')::timestamptz<=now() then raise exception 'Registration deadline must be in the future';end if;
 insert into locations(name,address,latitude,longitude,created_by) values(payload->>'venue',payload->>'address',(payload->>'latitude')::float8,(payload->>'longitude')::float8,u) returning id into lid;
 insert into tournaments(organizer_id,name,sport_id,location_id,starts_at,registration_deadline,max_teams) values(u,payload->>'name',payload->>'sport_id',lid,(payload->>'starts_at')::timestamptz,(payload->>'registration_deadline')::timestamptz,(payload->>'max_teams')::int) returning id into tid;return tid;
end$$;
create function public.tournament_action(tid uuid,action text,sid uuid default null,mid uuid default null,a int default null,b int default null) returns void language plpgsql security definer set search_path=public as $$
declare u uuid:=require_user();t tournaments;m tournament_matches;ids uuid[];n int;r int;i int;winner uuid;
begin
 select * into t from tournaments where id=tid for update;
 if t.id is null or blocked(u,t.organizer_id) then raise exception 'Tournament unavailable';end if;
 if action in ('register','withdraw') then
  if t.status<>'registration' or now()>=t.registration_deadline then raise exception 'Registration is closed';end if;
  if not exists(select 1 from squads where id=sid and owner_id=u) then raise exception 'Only the squad owner may register';end if;
  if action='withdraw' then delete from tournament_teams where tournament_id=tid and squad_id=sid;return;end if;
  if (select count(*) from tournament_teams where tournament_id=tid)>=t.max_teams then raise exception 'Tournament is full';end if;
  insert into tournament_teams(tournament_id,squad_id) values(tid,sid);
 else
  if t.organizer_id<>u then raise exception 'Only the organizer may manage this tournament';end if;
  if action='start' then
   if t.status<>'registration' or now()<t.registration_deadline then raise exception 'Wait for registration to close';end if;
   select array_agg(id order by registered_at,id) into ids from tournament_teams where tournament_id=tid;
   n:=coalesce(array_length(ids,1),0);
   if n<>t.max_teams then raise exception 'A full bracket is required before starting';end if;
   for i in 1..n/2 loop insert into tournament_matches(tournament_id,round,slot,team_a,team_b) values(tid,1,i,ids[2*i-1],ids[2*i]);end loop;
   r:=2;n:=n/4;
   while n>=1 loop for i in 1..n loop insert into tournament_matches(tournament_id,round,slot) values(tid,r,i);end loop;r:=r+1;n:=n/2;end loop;
   update tournaments set status='live' where id=tid;
  elsif action='score' then
   if t.status<>'live' then raise exception 'Tournament is not live';end if;
   select * into m from tournament_matches where id=mid and tournament_id=tid for update;
   if m.id is null or m.team_a is null or m.team_b is null or m.winner_id is not null or a is null or b is null or a=b or a<0 or b<0 then raise exception 'Enter a non-tied result for an unplayed match';end if;
   winner:=case when a>b then m.team_a else m.team_b end;
   update tournament_matches set score_a=a,score_b=b,winner_id=winner where id=mid;
   if exists(select 1 from tournament_matches where tournament_id=tid and round=m.round+1 and slot=(m.slot+1)/2) then
    if m.slot%2=1 then update tournament_matches set team_a=winner where tournament_id=tid and round=m.round+1 and slot=(m.slot+1)/2;else update tournament_matches set team_b=winner where tournament_id=tid and round=m.round+1 and slot=(m.slot+1)/2;end if;
   else update tournaments set status='completed' where id=tid;end if;
  elsif action='cancel' then
   if t.status='completed' then raise exception 'Completed tournaments cannot be cancelled';end if;
   update tournaments set status='cancelled' where id=tid;
  else raise exception 'Unknown tournament action';end if;
 end if;
end$$;
create function public.edit_game(gid uuid,payload jsonb) returns void language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();g games;begin
 select * into g from games where id=gid for update;
 if g.host_id is distinct from u or g.status<>'upcoming' then raise exception 'Only hosts may edit upcoming games';end if;
 if (payload->>'capacity')::int<(select count(*) from game_players where game_id=gid) then raise exception 'Capacity cannot be below current attendance';end if;
 if (payload->>'starts_at')::timestamptz<=now() then raise exception 'Choose a future start time';end if;
 update games set title=payload->>'title',description=coalesce(payload->>'description',''),capacity=(payload->>'capacity')::int,starts_at=(payload->>'starts_at')::timestamptz where id=gid;
 insert into notifications(user_id,title,body,path) select user_id,'Game details changed',payload->>'title','/game/'||gid from game_players where game_id=gid;
end$$;
create function public.leaderboard(sport text default null,area text default null) returns table(id uuid,name text,xp bigint,reliability numeric,games bigint) language sql stable security definer set search_path=public as $$
 select p.id,p.name,xp_total(p.id),reliability(p.id),(select count(*) from reliability_events r where r.user_id=p.id and r.attended) from profiles p
 where exists(select 1 from profiles active where active.id=auth.uid() and not active.disabled) and not blocked(auth.uid(),p.id) and (sport is null or sport=any(p.sports)) and (area is null or lower(p.city)=lower(area)) order by xp_total(p.id) desc,p.created_at limit 50
$$;
revoke execute on function public.create_tournament(jsonb),public.tournament_action(uuid,text,uuid,uuid,int,int),public.edit_game(uuid,jsonb),public.leaderboard(text,text) from public,anon;
grant execute on function public.create_tournament(jsonb),public.tournament_action(uuid,text,uuid,uuid,int,int),public.edit_game(uuid,jsonb),public.leaderboard(text,text) to authenticated;
