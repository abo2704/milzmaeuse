// Supabase Edge Function "recipe-import"
// Holt eine Rezeptseite (KptnCook-Teilen-Link, Chefkoch, die meisten Rezept-Blogs) ab und liest das
// standardisierte schema.org/Recipe-Format aus. Läuft serverseitig, weil Browser fremde Seiten nicht
// direkt auslesen dürfen (CORS). Nur für eingeloggte Nutzer: Die Anmeldung wird unten im Code geprüft,
// deshalb in den Funktions-Settings "Verify JWT with legacy secret" AUSschalten.
//
// Einrichten: Supabase → Edge Functions → Deploy a new function → Via Editor →
// Name "recipe-import" → diesen Inhalt einfügen → Deploy.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Keine internen Adressen abrufen (Schutz vor Missbrauch der Funktion)
function isPublicHost(host: string) {
  if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return false; // keine IP-Adressen
  return true;
}

type Json = Record<string, unknown>;
function findRecipe(node: unknown): Json | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
  const o = node as Json;
  const t = o['@type'];
  if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return o;
  return findRecipe(o['@graph']) ?? findRecipe(o['mainEntity']);
}
const text = (v: unknown): string => typeof v === 'string' ? v : Array.isArray(v) ? text(v[0]) : (v && typeof v === 'object' ? text((v as Json).url ?? (v as Json).name ?? '') : '');
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').trim();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    // Nur eingeloggte Mäuse: Token bei Supabase Auth prüfen (funktioniert mit alten und neuen Schlüsseln)
    const authHeader = req.headers.get('authorization') ?? '';
    const apikey = req.headers.get('apikey') ?? '';
    if (!authHeader.startsWith('Bearer ') || !apikey) return json({ error: 'Bitte zuerst einloggen.' }, 401);
    const who = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, { headers: { Authorization: authHeader, apikey } });
    if (!who.ok) return json({ error: 'Bitte zuerst einloggen.' }, 401);

    const { url } = await req.json();
    const u = new URL(String(url));
    if (!/^https?:$/.test(u.protocol) || !isPublicHost(u.hostname)) return json({ error: 'Diese Adresse kann ich nicht abrufen.' }, 400);

    const res = await fetch(u, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Milzmaeuse-Rezeptimport/1.0)', 'Accept-Language': 'de-DE,de;q=0.9' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return json({ error: `Seite nicht erreichbar (${res.status})` }, 502);
    const final = new URL(res.url);
    if (!isPublicHost(final.hostname)) return json({ error: 'Diese Adresse kann ich nicht abrufen.' }, 400);
    const html = (await res.text()).slice(0, 3_000_000);

    let recipe: Json | null = null;
    for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try { recipe = findRecipe(JSON.parse(m[1].trim())); } catch { /* kaputtes JSON überspringen */ }
      if (recipe) break;
    }
    if (!recipe) return json({ error: 'Auf der Seite habe ich kein Rezept gefunden. Tipp: Zutaten als Text einfügen.' }, 422);

    const ingredients = (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [])
      .map((x) => decode(String(x))).filter(Boolean);
    const servings = parseFloat(String(text(recipe.recipeYield)).replace(',', '.')) || 2;
    const nutrition = recipe.nutrition as Json | undefined;
    return json({
      title: decode(text(recipe.name)) || 'Rezept',
      image: text(recipe.image),
      url: text(recipe.url) || res.url,
      servings,
      ingredients,
      totalTime: text(recipe.totalTime),
      protein: nutrition ? parseFloat(String(nutrition.proteinContent ?? '')) || null : null,
      source: final.hostname.replace(/^www\./, ''),
    });
  } catch (e) {
    return json({ error: 'Import fehlgeschlagen: ' + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
