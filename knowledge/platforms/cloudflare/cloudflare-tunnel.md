---
reviewed: 2026-08-16
tags: [cloudflare, security, cli, infrastructure]
---

# Cloudflare Tunnel and Zero Trust

`cloudflared` connects an origin — a laptop, a home server, a Kubernetes cluster, a private subnet — to Cloudflare over an **outbound-only** connection, so the service can be published (or kept private behind authentication) without a public IP, an inbound firewall rule, or port forwarding. Combined with **Cloudflare Access** it becomes an identity-aware proxy in front of internal services. Both sit under the **Cloudflare One** umbrella.

Official: [developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)

> Docs URLs moved: the old `/cloudflare-one/connections/connect-networks/…` paths now 404. Also note the 2026 renames — the **WARP client** is now the **Cloudflare One Client**, and **WARP Connector** is now **Cloudflare Mesh**.

## Install

```bash
brew install cloudflared                       # macOS
docker run cloudflare/cloudflared:latest --version

# Debian/Ubuntu
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install cloudflared
```

Latest release **2026.8.2** (2026-08-14) — 2026.8.0/2026.8.1 shipped path-normalization bugs, so skip them. Cloudflare supports versions released within the past year.

## Quick tunnels (development)

```bash
cloudflared tunnel --url http://localhost:8787
# → https://<random-words>.trycloudflare.com
```

No account, no DNS, no configuration — ideal for demoing a `wrangler dev` server or a webhook receiver. Constraints to know: **testing and development only**, no SLA, no authentication, a hard cap of **200 in-flight requests** (HTTP 429 beyond), and **no Server-Sent Events support**.

## Named tunnels

Dashboard-managed (recommended for servers) needs only a token:

```bash
cloudflared tunnel --no-autoupdate run --token <TOKEN>
```

Locally-managed keeps the configuration in files:

```bash
cloudflared tunnel login                      # writes cert.pem
cloudflared tunnel create my-tunnel           # writes ~/.cloudflared/<UUID>.json
cloudflared tunnel route dns my-tunnel app.example.com
cloudflared tunnel run my-tunnel
```

```yaml
# ~/.cloudflared/config.yml
tunnel: 6ff42ae2-765d-4adf-8112-31c55c1551ef
credentials-file: /home/user/.cloudflared/6ff42ae2-765d-4adf-8112-31c55c1551ef.json
originRequest:
  connectTimeout: 30s
ingress:
  - hostname: app.example.com
    service: http://localhost:3000
  - hostname: static.example.com
    path: \.(jpg|png|css|js)$
    service: http://localhost:8001
  - service: http_status:404          # catch-all is mandatory
```

- Ingress rules are evaluated top to bottom and the file **must end with a catch-all rule**
- `cloudflared tunnel ingress rule <URL>` shows which rule a URL matches — use it before restarting anything
- A tunnel is a persistent UUID; several `cloudflared` processes running the same tunnel are independent connectors (that is how you get HA)

### Running as a service

```bash
sudo cloudflared --config /home/<USER>/.cloudflared/config.yml service install
sudo systemctl status cloudflared
```

Pass `--config` explicitly under `sudo`, because `$HOME` becomes `/root`.

```yaml
# docker-compose.yaml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: always
    command: tunnel run --token ${TUNNEL_TOKEN}
```

On Kubernetes, run it as its own Deployment (`cloudflared tunnel --no-autoupdate --loglevel info --metrics 0.0.0.0:2000 run`). Replicas are for high availability only — Cloudflare explicitly **advises against autoscaling**, because removing replicas breaks existing connections.

## Cloudflare Access in front of a tunnel

Access applications are **deny by default**: a user must match an Allow policy. Machine callers authenticate with a **service token** sent as `CF-Access-Client-Id` and `CF-Access-Client-Secret` (the secret is displayed once, at creation).

At the origin, validate the **`Cf-Access-Jwt-Assertion`** header rather than the `CF_Authorization` cookie — the cookie is not guaranteed to be forwarded. Fetch the JWKS from `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` and match the token's `kid` against `public_certs`.

Account limits (independent of plan): 500 Access applications, 300 rule groups, 1,000 rules per group, 500 Gateway policies per type, **1,000 tunnels per account**. Seats are consumed by any authentication event and freed when the user is removed. The Zero Trust free tier has long covered 50 seats — Cloudflare's pricing pages render client-side, so confirm the current number before planning around it.

Since 2026-08-14, Access can also be enabled directly on a Worker (or on all Workers at once).

## Related Cloudflare One pieces

- **Cloudflare One Client** (formerly WARP): device agent that sends traffic to Cloudflare, applying Gateway policies and device posture wherever the device is; deployable by MDM
- **Gateway**: filters DNS, network (L4), and HTTP (L7) traffic across Cloudflare's edge instead of a perimeter appliance
- **Private network routing**: `cloudflared tunnel route ip add 10.0.0.0/24 my-tunnel` publishes a CIDR to enrolled clients. The client must be in Traffic-and-DNS mode, and **WARP excludes RFC 1918 space by default** — fix Split Tunnels or nothing routes
- **Cloudflare Mesh** (formerly WARP Connector): post-quantum-encrypted TCP/UDP/ICMP mesh between sites, with existing connectors now called mesh nodes

## Pitfalls

1. **DNS record conflict** — `tunnel route dns` fails with error **81054** when an A/AAAA/CNAME already exists for the hostname. Delete the old record first
2. **Missing catch-all ingress rule** — the config is rejected
3. **`noTLSVerify: true`** disables origin certificate verification entirely. Prefer `originServerName` or a CA bundle
4. **Tunnel token handling** — a token on the command line is visible in `ps`; keep it in an environment file or secret store, never in git (secret scanners have a dedicated detector for it)
5. **Autoscaling `cloudflared`** breaks in-flight connections on scale-down
6. **Authenticated Origin Pulls does not work with Tunnel origins** — the tunnel already authenticates the path

## References

- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/) — [downloads](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/) / [configuration file](https://developers.cloudflare.com/tunnel/advanced/local-management/configuration-file/) / [run parameters](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/run-parameters/) / [TryCloudflare](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)
- [Kubernetes deployment](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/deployment-guides/kubernetes/) / [as a service](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/as-a-service/linux/)
- [Access self-hosted apps](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/) / [service tokens](https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/) / [validating JWTs](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/) / [account limits](https://developers.cloudflare.com/cloudflare-one/account-limits/)
- Related: [`cloudflare.md`](cloudflare.md), [`cloudflare-dns-cdn.md`](cloudflare-dns-cdn.md), [`cloudflare-workers.md`](cloudflare-workers.md)
