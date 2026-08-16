---
reviewed: 2026-08-16
tags: [cloudflare, infrastructure, security, cloud-hosted]
---

# Cloudflare DNS, CDN, Rules, WAF, and TLS

The zone-level half of Cloudflare: authoritative DNS, the reverse-proxy cache, the Ruleset Engine products that replaced Page Rules, the WAF, and the origin TLS modes. This is what most "we put the site behind Cloudflare" work actually touches, and it is configured per zone rather than per Worker.

Official: [developers.cloudflare.com/dns](https://developers.cloudflare.com/dns/) / [cache](https://developers.cloudflare.com/cache/) / [rules](https://developers.cloudflare.com/rules/) / [waf](https://developers.cloudflare.com/waf/) / [ssl](https://developers.cloudflare.com/ssl/)

## DNS

- **Proxied (orange cloud)** puts Cloudflare between visitors and the origin; **DNS-only (grey cloud)** just answers with the origin IP. Only **A, AAAA, and CNAME** records can be proxied — MX, TXT, and the rest are always DNS-only
- Proxied records report a fixed **300 s "Auto" TTL**; the real TTL is Cloudflare's, not yours
- **CNAME flattening** returns the resolved IP so an apex CNAME works. "Flatten all CNAMEs" can break third-party verification that expects the literal CNAME; a dangling CNAME returns an empty answer, and a CNAME pointing at another Cloudflare account yields **Error 1014**
- **Partial (CNAME) setup** — keeping your existing DNS provider and proxying selected hostnames — is **Business and Enterprise only**, and unavailable on Cloudflare Registrar domains
- There is **no `wrangler dns` command**. Manage records through the dashboard, the REST API (`POST /zones/{zone_id}/dns_records`), or the Terraform provider (`cloudflare/cloudflare` v5, an OpenAPI-generated rewrite; v5.23.0 was released 2026-08-05)
- A Worker on a **partial setup** zone gets `530 (1016)` from `fetch()` unless the target DNS record exists in Cloudflare DNS

## Cache

- Cloudflare caches by **file extension** by default — HTML and JSON are **not** in the list (CSS, JS, images, fonts, archives, media, documents are). Responses with `private`, `no-store`, `no-cache`, `max-age=0`, or `Set-Cookie` are not cached, and only GET is cacheable. When both `max-age` and `Expires` are present, `max-age` wins
- Default Edge TTL when the origin says nothing: **200/206/301 → 120 min, 302/303 → 20 min, 404/410 → 3 min**
- **Cache Rules** are the current control surface (eligibility, Edge/Browser TTL, custom cache keys) and replace the caching half of Page Rules
- **Tiered Cache** with Smart Topology is available on all plans; Generic Global / Regional / Custom topologies are Enterprise-only
- **Cache Reserve** is a persistent R2-backed layer: $0.015/GB-month storage, $4.50/M writes, $0.36/M reads, eviction after 30 days without a request. Requires a paid plan
- **Purge by URL, hostname, tag, and prefix is available on every plan** since 2025-04-01 — the old "tag purge is Enterprise-only" rule is gone; only rate limits differ by plan (800 URLs/s on Free up to 3,000 URLs/s on Enterprise). `Cache-Tag` headers cap at 16 KB (~1,000 tags)

From a Worker, cache behavior is controlled per request:

```ts
await fetch(url, { cf: { cacheEverything: true, cacheTtlByStatus: { "200-299": 3600, "404": 60 }, cacheTags: ["post:42"] } });
```

The Cache API (`caches.default`, `caches.open("custom:cache")`) is **per-data-center, not globally replicated**, rejects non-GET `put()`, cannot store 206 or `Vary: *`, and is a no-op in the dashboard editor and Playground.

## Rules

Page Rules are labeled **deprecated** but have **no announced end-of-life date**; Cloudflare's automatic migration is described as "late 2025 or beyond." The successors, all built on the Ruleset Engine:

| Product | Replaces / does | Plan counts (Free/Pro/Business/Enterprise) |
|---|---|---|
| **Cache Rules** | Cache Level, Edge/Browser TTL, cache keys | — |
| **Origin Rules** | Host Header Override, port/SNI/DNS override | 10 / 25 / 50 / 300 (host, SNI, DNS override are Enterprise-only) |
| **Transform Rules** | URL rewrites, request/response header transforms | — |
| **Redirect Rules** | Forwarding URL, Always Use HTTPS | — (Bulk Redirects for large sets) |
| **Configuration Rules** | Security Level, Browser Integrity Check, SSL per path | 10 / 25 / 50 / 300 |
| **Compression Rules** | Per-path compression; last match wins | 10 / 25 / 50 / 300 |
| **Snippets** | Small JavaScript at the edge without a Worker | **Not on Free**: 25 / 50 / 300, with 2 / 3 / 5 subrequests, 5 ms CPU, 2 MB memory, 32 KB package |

Page Rules themselves: 3 / 20 / 50 / 125. `Disable Security`, `Disable Performance`, `Response Buffering`, and WAF settings will **not** be migrated automatically.

## WAF and bots

- The **Free Managed Ruleset** is available on **all plans**, including Free — protection against high-impact, widely exploited vulnerabilities. It becomes redundant once the full Cloudflare Managed Ruleset is deployed
- The **Cloudflare Managed Ruleset**, **OWASP Core Ruleset**, and Exposed Credentials Check require Pro or above; Sensitive Data Detection is Enterprise-only
- **Custom rules**: 5 / 20 / 100 / 1,000 by plan
- **Rate limiting rules**: Free gets 1 rule (10 s period, IP-only counting); Pro 2 (up to 1 min), Business 5 (up to ~18 h), Enterprise 100. For per-Worker limits, use the [Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) instead
- **Bot Fight Mode** (Free) is domain-wide with no per-endpoint exceptions, cannot be bypassed by custom rules, and forces JS Detections on — a CSP must allow `/cdn-cgi/challenge-platform/`

## SSL/TLS

| Mode | Cloudflare → origin | Verdict |
|---|---|---|
| Off | Plaintext, no HTTPS | Never |
| Flexible | HTTP to origin, HTTPS to visitor | Causes redirect loops; avoid |
| Full | HTTPS, certificate not validated | Minimum acceptable |
| Full (strict) | HTTPS, certificate validated | **Recommended** |
| Strict (SSL-Only Origin Pull) | Validated, no fallback | Strongest |

- **Automatic SSL/TLS** is rolling out as the default: Cloudflare scans the zone monthly and incrementally upgrades traffic to the most secure mode that works, never downgrading. Opt out by choosing "Custom SSL/TLS"
- **Universal SSL** issues free, auto-renewing DV certificates once the domain is active; full setup covers the apex plus first-level subdomains
- **Origin CA** certificates secure the Cloudflare→origin hop only, are free on all plans, cover up to 200 SANs, and support validity from 7 days to ~15 years. They require Full (strict)
- **Authenticated Origin Pulls** makes the origin verify that requests came from Cloudflare (global, zone-level, or per-hostname certificates). It does **not** work with Cloudflare Tunnel origins
- **The classic Flexible-mode loop**: visitor → HTTPS → Cloudflare → HTTP → origin redirects to HTTPS → repeat. Fix by moving to Full or higher, not by removing the origin redirect

## Plan differences worth knowing

| | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| Price | $0 | $20/mo annual ($25 monthly) | $200/mo annual ($250 monthly) | Custom |
| Page Rules | 3 | 20 | 50 | 125 |
| WAF custom rules | 5 | 20 | 100 | 1,000 |
| Rate limiting rules | 1 | 2 | 5 | 100 |
| Snippets | — | 25 | 50 | 300 |
| Upload size limit | 100 MB | 100 MB | 200 MB | 500 MB+ (HTTP 413 beyond) |
| Partial (CNAME) setup | — | — | Yes | Yes |

## References

- [Proxy status](https://developers.cloudflare.com/dns/proxy-status/) / [proxied record types](https://developers.cloudflare.com/dns/manage-dns-records/reference/proxied-dns-records/) / [CNAME flattening](https://developers.cloudflare.com/dns/cname-flattening/) / [partial setup](https://developers.cloudflare.com/dns/zone-setups/partial-setup/)
- [Default cache behavior](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/) / [Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/) / [purge cache](https://developers.cloudflare.com/cache/how-to/purge-cache/) / [Cache Reserve](https://developers.cloudflare.com/cache/about/cache-reserve/) / [Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [Page Rules migration](https://developers.cloudflare.com/rules/reference/page-rules-migration/) / [Snippets](https://developers.cloudflare.com/rules/snippets/) / [managed rules](https://developers.cloudflare.com/waf/managed-rules/) / [rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [SSL/TLS modes](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/) / [Origin CA](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/) / [authenticated origin pull](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/) / [too many redirects](https://developers.cloudflare.com/ssl/troubleshooting/too-many-redirects/)
- Related: [`cloudflare.md`](cloudflare.md), [`cloudflare-tunnel.md`](cloudflare-tunnel.md), [`cloudflare-workers.md`](cloudflare-workers.md)
