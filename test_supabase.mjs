import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://xkpkmqlcxtlcdkmccbhs.supabase.co', 'sb_publishable_mF8_8Ep4ouZylaxNBzdDxw_ToZ6E_LT');

const testId = crypto.randomUUID();
console.log('Test ID:', testId);

// Try insert with snake_case fields
const { data: ins, error: insErr } = await supabase.from('employees').insert({
  id: testId,
  company_id: '00000000-0000-0000-0000-000000000000',
  nom: 'Test',
  prenom: 'User',
  salaire_base: 1000,
  regime: '40h',
  situation_famille: 'celibataire',
  nb_enfants: 0
}).select();

console.log('INSERT result:', JSON.stringify(ins));
console.log('INSERT error:', insErr ? insErr.message : 'none', 'code:', insErr ? insErr.code : '');

// Try just a select
const { data: sel, error: selErr } = await supabase.from('employees').select('*').limit(1);
console.log('SELECT result:', JSON.stringify(sel));
console.log('SELECT error:', selErr ? selErr.message : 'none', 'code:', selErr ? selErr.code : '');

// Clean up
if (!insErr && testId) {
  await supabase.from('employees').delete().eq('id', testId);
}
