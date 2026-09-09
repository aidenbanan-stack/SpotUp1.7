import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
const names=readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort();
const sql='-- NEW EMPTY SUPABASE PROJECT ONLY. Generated from migrations.\nBEGIN;\n'+names.map(n=>'\n-- '+n+'\n'+readFileSync('supabase/migrations/'+n,'utf8')+'\n').join('')+'COMMIT;\n';
writeFileSync('supabase/bootstrap.sql',sql);
console.log(`Generated bootstrap from ${names.length} migrations.`);
