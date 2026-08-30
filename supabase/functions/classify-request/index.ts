// ============================================================
// AI CLASSIFICATION EDGE FUNCTION
// ============================================================
// This runs on SUPABASE's servers, not the user's browser and not
// your laptop. The frontend calls it over HTTPS (see RequestHelp.tsx),
// it asks an AI model to read the emergency description and classify
// it, and hands back a strict category + urgency.
//
// Uses GROQ instead of Anthropic here specifically because Groq has
// a genuinely free tier with no credit card required — a practical
// choice for a hackathon budget. Groq hosts open models (like
// Llama 3.1) and serves them extremely fast, which matters for a
// live demo. The overall approach — server-side call, secret key,
// strict JSON instructions, defensive parsing — is identical
// regardless of which AI provider sits behind it; only this one
// function's internals changed, nothing else in the app did.
//
// Why server-side at all, rather than calling this from the
// browser? Because that would mean putting the API key into
// frontend JavaScript, which anyone could open DevTools and steal.
// Here, the key lives only on Supabase's server as a "secret" — the
// browser never sees it.
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// The only two lists our database's check constraints actually
// allow (see schema.sql) — we validate the AI's answer against these
// before trusting it, since a model can occasionally drift from
// instructions.
const VALID_CATEGORIES = ['medical', 'food', 'shelter', 'rescue'];
const VALID_URGENCIES = ['critical', 'high', 'medium', 'low'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { description } = await req.json();

    if (!description || typeof description !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing description' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Reads the secret from Supabase's own secret store — set via
    // `supabase secrets set GROQ_API_KEY=...`, never written into
    // any file in this codebase.
    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server is not configured with an API key' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Groq's API is "OpenAI-compatible" — same request/response
    // shape as OpenAI's chat completions endpoint, just pointed at
    // Groq's servers and Groq's models instead.
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // A small, fast model — the right choice here since this
        // runs on every single submission, potentially many times
        // during a live demo, and Groq is known for very low latency.
        // (llama-3.1-8b-instant, used in an earlier version of this
        // file, was deprecated by Groq — this is their own
        // recommended replacement for that exact use case.)
        model: 'openai/gpt-oss-20b',
        temperature: 0, // we want consistent, predictable classification, not creative variation
        // gpt-oss is a REASONING model — before writing its actual
        // answer, it spends tokens on internal "thinking" first.
        // 100 tokens wasn't enough room for both that reasoning AND
        // the final JSON answer, so on one submission it used the
        // whole budget thinking and had nothing left to actually
        // write the answer — an empty response, which is what broke
        // JSON.parse. Two changes fix this: more total room, and
        // telling it explicitly to keep reasoning brief since this
        // is a simple classification task, not a hard problem.
        max_tokens: 400,
        reasoning_effort: 'low',
        messages: [
          {
            role: 'system',
            content: `You triage emergency reports for a disaster response app. Given a short description, respond with ONLY a JSON object, no other text, no markdown formatting, in exactly this shape:
{"category": "medical" | "food" | "shelter" | "rescue", "urgency": "critical" | "high" | "medium" | "low"}
Pick the single best-fitting category and urgency. Respond with nothing except that JSON object.`,
          },
          { role: 'user', content: description },
        ],
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      throw new Error(`Groq API error: ${errText}`);
    }

    const groqData = await groqResponse.json();
    // This is the OpenAI-compatible response shape Groq follows —
    // the model's reply text lives at this exact path.
    const rawText: string = groqData.choices[0].message.content.trim();

    // A clear, specific error here instead of letting an empty
    // string fall straight into JSON.parse — that would throw the
    // much less helpful native "Unexpected end of JSON input",
    // which doesn't tell you WHY the content was empty in the first
    // place. This also gives a precise place to look if this ever
    // happens again despite the token/effort fix above.
    if (!rawText) {
      throw new Error('Model returned empty content (likely ran out of tokens before writing its answer)');
    }

    // Defensive parsing: even with clear instructions, a model can
    // occasionally wrap its answer in ```json fences or add stray
    // whitespace. This strips that before attempting to parse.
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Validate against our actual allowed values — if the model
    // somehow returned something outside our database's check
    // constraints, we catch that HERE instead of letting a broken
    // insert fail later with a confusing database error.
    if (!VALID_CATEGORIES.includes(parsed.category) || !VALID_URGENCIES.includes(parsed.urgency)) {
      throw new Error(`Unexpected classification values: ${cleaned}`);
    }

    return new Response(JSON.stringify({ category: parsed.category, urgency: parsed.urgency }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // console.error here is what makes the actual failure reason
    // show up in Supabase's function Logs tab, not just the HTTP
    // response body.
    console.error('classify-request failed:', error);

    // Any failure here (network issue, bad JSON, Groq API hiccup)
    // returns a clean error instead of crashing — the frontend is
    // built to fall back gracefully (see RequestHelp.tsx) rather
    // than blocking someone's real emergency submission over a
    // classification failure.
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
