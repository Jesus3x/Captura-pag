import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function validateEmail(email){
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const name = (body.name || '').toString().trim().slice(0, 200);
  const email = (body.email || '').toString().trim().toLowerCase().slice(0, 320);

  if (!validateEmail(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'E-mail inválido.' }) };
  }

  try {
    const { data, error } = await supabase
      .from('contacts')
      .insert({ name, email })
      .select('id, name, email, created_at')
      .limit(1);

    if (error) {
      if (error.code === '23505' || /unique/i.test(error.message || '')) {
        return { statusCode: 409, body: JSON.stringify({ error: 'E-mail já cadastrado.' }) };
      }
      console.error('Supabase insert error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao salvar.' }) };
    }

    return { statusCode: 201, body: JSON.stringify({ contact: data[0] }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro interno.' }) };
  }
}
