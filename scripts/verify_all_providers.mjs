import fs from 'fs';

function getEnv() {
  const env = {};
  for (const f of ['.env.production.local', '.env.local']) {
    if (fs.existsSync(f)) {
      fs.readFileSync(f, 'utf8').split('\n').forEach(l => {
        const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m) {
          let v = m[2].trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          env[m[1]] = v;
        }
      });
    }
  }
  return env;
}

const env = getEnv();

async function run() {
  console.log('=== GEMINI TEST ===');
  const gKey = env.GEMINI_API_KEY;
  if (!gKey) {
    console.log('Missing GEMINI_API_KEY');
  } else {
    for (const model of ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash']) {
      const start = Date.now();
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Respond with OK' }] }] })
        });
        const elapsed = Date.now() - start;
        const text = await res.text();
        console.log(`Gemini ${model}: status=${res.status} in ${elapsed}ms -> ${text.slice(0, 150)}`);
      } catch (e) {
        console.log(`Gemini ${model}: error=${e.message}`);
      }
    }
  }

  console.log('\n=== ANTHROPIC TEST ===');
  const aKey = env.ANTHROPIC_API_KEY;
  if (!aKey) {
    console.log('Missing ANTHROPIC_API_KEY');
  } else {
    for (const model of ['claude-3-5-sonnet-20241022', 'claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022']) {
      const start = Date.now();
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': aKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model,
            max_tokens: 50,
            messages: [{ role: 'user', content: 'Respond with OK' }]
          })
        });
        const elapsed = Date.now() - start;
        const text = await res.text();
        console.log(`Anthropic ${model}: status=${res.status} in ${elapsed}ms -> ${text.slice(0, 150)}`);
      } catch (e) {
        console.log(`Anthropic ${model}: error=${e.message}`);
      }
    }
  }

  console.log('\n=== OPENAI TEST ===');
  const oKey = env.OPENAI_API_KEY;
  if (!oKey) {
    console.log('Missing OPENAI_API_KEY');
  } else {
    for (const model of ['gpt-4o', 'gpt-4o-mini']) {
      const start = Date.now();
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${oKey}`
          },
          body: JSON.stringify({
            model,
            max_tokens: 50,
            messages: [{ role: 'user', content: 'Respond with OK' }]
          })
        });
        const elapsed = Date.now() - start;
        const text = await res.text();
        console.log(`OpenAI ${model}: status=${res.status} in ${elapsed}ms -> ${text.slice(0, 150)}`);
      } catch (e) {
        console.log(`OpenAI ${model}: error=${e.message}`);
      }
    }
  }
}

run();
