// Cloudflare Worker — Claude API CORS Proxy
// Deploy at: https://workers.cloudflare.com (free tier: 100K req/day)
//
// What it does: accepts POST from your tracker, forwards to Anthropic's API,
// adds CORS headers so your browser will accept the response.
//
// SECURITY: Your API key never lives in this Worker — it's passed through
// from the tracker on each request. The Worker only adds CORS headers.
// If you want extra security, restrict ALLOWED_ORIGIN below.

const ALLOWED_ORIGIN = '*'; // Change to 'https://chasechavez.github.io' for stricter security

export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access',
      'Access-Control-Max-Age': '86400',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Use POST', { status: 405, headers: corsHeaders });
    }

    // Forward everything to Anthropic
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: { message: 'Missing x-api-key header' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.text();

    try {
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01',
        },
        body,
      });

      const responseBody = await upstream.text();
      return new Response(responseBody, {
        status: upstream.status,
        headers: {
          ...corsHeaders,
          'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: { message: 'Proxy error: ' + err.message } }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  },
};
