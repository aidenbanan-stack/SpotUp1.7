# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/4a44deb6-2e39-468e-b5cc-263aa69a1a82

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/4a44deb6-2e39-468e-b5cc-263aa69a1a82) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

You can deploy with Lovable, or deploy directly with a host like Vercel.

### Deploy with Vercel
1. Import the GitHub repo into Vercel.
2. Build Command: `npm run build`
3. Output Directory: `dist`
4. Add Environment Variables in Vercel (Project Settings -> Environment Variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - (optional) `VITE_GOOGLE_MAPS_API_KEY`

## Supabase setup (games persistence)

This app can load and store games in Supabase.

1. Create a Supabase project.
2. In the SQL editor, create a `games` table:

```sql
create extension if not exists "uuid-ossp";

create table if not exists public.games (
  id uuid primary key default uuid_generate_v4(),
  host_id text not null,
  sport text not null,
  title text not null,
  description text,
  date_time timestamptz not null,
  duration integer not null,
  skill_requirement text not null,
  max_players integer not null,
  player_ids text[] not null default '{}',
  pending_request_ids text[] not null default '{}',
  is_private boolean not null default false,
  status text not null default 'scheduled',
  checked_in_ids text[] not null default '{}',
  runs_started boolean not null default false,
  ended_at timestamptz,
  post_game_votes jsonb,
  post_game_voters jsonb,
  location_latitude double precision not null,
  location_longitude double precision not null,
  location_area_name text not null,
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "Public read games"
on public.games for select
to anon
using (true);

create policy "Public insert games"
on public.games for insert
to anon
with check (true);

create policy "Public update games"
on public.games for update
to anon
using (true);
```

3. Copy your project URL and anon key into:
   - Local dev: create `.env` using `.env.example`
   - Vercel: Project Settings -> Environment Variables

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
