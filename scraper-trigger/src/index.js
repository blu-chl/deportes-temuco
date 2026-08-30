// Dispara el workflow "Web Scraper" de GitHub Actions desde el botón de
// Admin en la app. El token de GitHub NUNCA va en el navegador — vive acá
// como secreto de Cloudflare, y este Worker solo lo usa si quien llama
// trae un token de sesión de Supabase válido (o sea, un admin logueado).

const ALLOWED_ORIGIN = 'https://blu-chl.github.io';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Vary': 'Origin',
    },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        },
      });
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const auth = request.headers.get('Authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Falta sesión — iniciá sesión como admin' }, 401);

    // Verifica que el token sea de un usuario real y logueado en Supabase
    // (mismo mecanismo que usa la app para las escrituras de Enriquecer).
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) return json({ error: 'Sesión inválida o vencida — volvé a loguearte' }, 401);

    const ghRes = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.GITHUB_WORKFLOW}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'deportes-temuco-scraper-trigger',
        },
        body: JSON.stringify({ ref: 'main' }),
      }
    );
    if (ghRes.status === 204) return json({ ok: true });
    const detail = await ghRes.text();
    return json({ error: 'GitHub rechazó el disparo del workflow', detail, status: ghRes.status }, 502);
  },
};
