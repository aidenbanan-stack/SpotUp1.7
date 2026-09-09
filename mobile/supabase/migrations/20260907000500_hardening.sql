create policy moderators_read_comments on comments for select to authenticated using(is_admin());
create policy moderators_read_messages on messages for select to authenticated using(is_admin());
create function public.limit_social_inserts() returns trigger language plpgsql security definer set search_path=public as $$declare u uuid:=require_user();n int;begin
 insert into api_quota values(u,'social',date_trunc('minute',now()),1) on conflict(user_id,service,window_start) do update set hits=api_quota.hits+1 returning api_quota.hits into n;
 if n>60 then raise exception 'Please slow down and try again in a minute';end if;return new;
end$$;
revoke execute on function public.limit_social_inserts() from public,anon,authenticated;
create trigger limit_follows before insert on follows for each row execute function limit_social_inserts();
create trigger limit_reactions before insert on reactions for each row execute function limit_social_inserts();
create trigger limit_saves before insert on saved_posts for each row execute function limit_social_inserts();
-- Client-chosen values remain bounded; no arbitrary sports or gigantic profiles.
alter table profiles add constraint known_sports check(sports <@ array['basketball','soccer','volleyball','tennis','other']::text[]);
alter table profiles add constraint city_length check(length(city)<=100);
alter table squads add constraint squad_description_length check(length(description)<=1000);
alter table posts add constraint post_category_length check(length(category) between 1 and 80);
alter table showcases add constraint showcase_category_length check(length(category) between 1 and 80);
create index media_pending on media_assets(state,created_at);
create index follows_target on follows(target_id,user_id);
create index blocks_target on blocks(target_id,user_id);
create index squad_member_user on squad_members(user_id);
create index notifications_pending on notifications(created_at) where delivered_at is null;
create index analytics_rate on analytics_events(user_id,created_at);
create index messages_rate on messages(user_id,created_at);
create index comments_rate on comments(user_id,created_at);
