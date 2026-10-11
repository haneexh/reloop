import fs from 'fs';

const local = fs.readFileSync('.env.local', 'utf8');
const env = {};
local.split('\n').forEach(l => {
  const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m) {
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
});

async function test() {
  console.log('Testing Anthropic with key from .env.local...');
  try {
    const resA = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 20,
        messages: [{ role: 'user', content: 'hi' }]
      })
    });
    console.log('Anthropic status:', resA.status, await resA.text());
  } catch (e) {
    console.log('Anthropic error:', e.message);
  }

  console.log('Testing OpenAI with key from .env.local...');
  try {
    const resO = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 20,
        messages: [{ role: 'user', content: 'hi' }]
      })
    });
    console.log('OpenAI status:', resO.status, await resO.text());
  } catch (e) {
    console.log('OpenAI error:', e.message);
  }
}
test();
