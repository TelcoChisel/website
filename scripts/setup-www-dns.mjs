#!/usr/bin/env node
/**
 * Enable www.telcochisel.com → https://telcochisel.com (301) on Cloudflare.
 *
 * Requires CLOUDFLARE_API_TOKEN with:
 *   Zone → Zone → Read
 *   Zone → DNS → Edit
 *   Zone → Dynamic Redirect → Edit  (or Account Rulesets Edit)
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... node scripts/setup-www-dns.mjs
 */

const ZONE_NAME = 'telcochisel.com'
const WWW_HOST = 'www.telcochisel.com'
const APEX = 'https://telcochisel.com'
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN

if (!TOKEN) {
  console.error('Missing CLOUDFLARE_API_TOKEN (needs Zone DNS Edit + Dynamic Redirect Edit).')
  process.exit(1)
}

async function cf(path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!json.success) {
    const msg = (json.errors || []).map((e) => e.message).join('; ') || res.statusText
    throw new Error(`${method} ${path}: ${msg}`)
  }
  return json.result
}

const zones = await cf(`/zones?name=${encodeURIComponent(ZONE_NAME)}`)
const zone = zones[0]
if (!zone) throw new Error(`Zone not found: ${ZONE_NAME}`)
const zoneId = zone.id

const existing = await cf(`/zones/${zoneId}/dns_records?name=${encodeURIComponent(WWW_HOST)}`)
let dns
if (existing.length) {
  dns = existing[0]
  console.log(`DNS already present: ${dns.type} ${dns.name} → ${dns.content} (proxied=${dns.proxied})`)
} else {
  // Match apex pattern (proxied AAAA 100::) so the hostname terminates on CF edge.
  dns = await cf(`/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: {
      type: 'AAAA',
      name: 'www',
      content: '100::',
      proxied: true,
      ttl: 1,
      comment: 'www.telcochisel.com (redirects to apex)',
    },
  })
  console.log(`Created DNS: AAAA ${dns.name} → ${dns.content} (proxied)`)
}

const expression = `(http.host eq "${WWW_HOST}")`
const wwwRule = {
  action: 'redirect',
  expression,
  description: 'www.telcochisel.com → telcochisel.com',
  enabled: true,
  action_parameters: {
    from_value: {
      status_code: 301,
      target_url: {
        expression: `concat("${APEX}", http.request.uri.path)`,
      },
      preserve_query_string: true,
    },
  },
}

let entry
try {
  entry = await cf(`/zones/${zoneId}/rulesets/phases/http_request_dynamic_redirect/entrypoint`)
} catch {
  entry = null
}

const rules = [...(entry?.rules || [])]
if (rules.some((r) => r.expression === expression)) {
  console.log('Redirect rule already present.')
} else if (entry?.id) {
  await cf(`/zones/${zoneId}/rulesets/${entry.id}`, {
    method: 'PUT',
    body: { rules: [wwwRule, ...rules] },
  })
  console.log('Added Single Redirect: www → apex (301).')
} else {
  await cf(`/zones/${zoneId}/rulesets`, {
    method: 'POST',
    body: {
      name: 'www to apex redirect',
      kind: 'zone',
      phase: 'http_request_dynamic_redirect',
      rules: [wwwRule],
    },
  })
  console.log('Created ruleset + Single Redirect: www → apex (301).')
}

console.log(`Done. Verify: curl -sI https://${WWW_HOST}/ | head`)
