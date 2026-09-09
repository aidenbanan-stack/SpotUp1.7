import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const target='deployment/supabase/migrations/20260909045448_preserve_accounts_rebuild.sql';
const migrations=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
const parts=[readFileSync('deployment/preserve-accounts-prefix.sql','utf8'),...migrations.map(f=>`-- ${f}\n${readFileSync(`supabase/migrations/${f}`,'utf8')}`),readFileSync('deployment/preserve-accounts-suffix.sql','utf8')];
writeFileSync(target,parts.join('\n\n'));
console.log(target);
