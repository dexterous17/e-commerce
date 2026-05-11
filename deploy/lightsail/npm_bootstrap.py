#!/usr/bin/env python3
"""
Idempotent Nginx Proxy Manager bootstrap: create or repair proxy hosts for storefront + API
when using docker-compose.nginx-proxy-manager.yml (forward to Docker service names).

If ecommerce.harshildex.com already exists in NPM but points at the wrong upstream (wrong
container, wrong port, or a static “default” site), this script updates it to match
NPM_FORWARD_* env vars.

Uses only the stdlib. Intended to run inside the npm-bootstrap compose service.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Any

ADVANCED_API = """proxy_buffering off;
proxy_request_buffering off;
client_max_body_size 50m;
proxy_read_timeout 300s;
"""


def storefront_advanced_config(forward_api_host: str, forward_api_port: int) -> str:
    """
    NPM injects this before the default location / block. Routes storefront API, media,
    and uploads to the API container (same Node app as backend.ecommerce.harshildex.com).
    /api/media is listed first so it wins over the shorter /api prefix.
    """
    return f"""client_max_body_size 50m;
proxy_read_timeout 300s;
proxy_send_timeout 300s;

location ^~ /api/media {{
  proxy_pass http://{forward_api_host}:{forward_api_port};
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_buffering off;
  proxy_request_buffering off;
  proxy_read_timeout 300s;
}}

location ^~ /api {{
  proxy_pass http://{forward_api_host}:{forward_api_port};
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_buffering off;
  proxy_request_buffering off;
  proxy_read_timeout 300s;
}}

location ^~ /uploads {{
  proxy_pass http://{forward_api_host}:{forward_api_port};
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_read_timeout 300s;
}}

location ^~ /upload {{
  proxy_pass http://{forward_api_host}:{forward_api_port};
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_read_timeout 300s;
}}
"""


def env(name: str, default: str | None = None) -> str | None:
    v = os.environ.get(name)
    if v is None or v.strip() == "":
        return default
    return v


def env_bool(name: str, default: bool = False) -> bool:
    value = env(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def request_json(
    method: str,
    url: str,
    *,
    body: dict[str, Any] | None = None,
    token: str | None = None,
    timeout: float = 60.0,
) -> Any:
    data = None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            if not raw.strip():
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} {method} {url}: {err_body}") from e


def parse_token(payload: Any) -> str:
    if isinstance(payload, dict):
        if "token" in payload and isinstance(payload["token"], str):
            return payload["token"]
        r = payload.get("result")
        if isinstance(r, dict) and isinstance(r.get("token"), str):
            return r["token"]
    raise RuntimeError(f"Unexpected token response: {payload!r}")


def host_has_domain(h: dict[str, Any], domain: str) -> bool:
    names = h.get("domain_names")
    if isinstance(names, list) and domain in names:
        return True
    if isinstance(names, str):
        try:
            parsed = json.loads(names)
            if isinstance(parsed, list) and domain in parsed:
                return True
        except json.JSONDecodeError:
            pass
    return False


def find_host_for_domain(hosts: list[Any], domain: str) -> dict[str, Any] | None:
    for h in hosts:
        if isinstance(h, dict) and host_has_domain(h, domain):
            return h
    return None


def norm_port(v: Any) -> int:
    if v is None:
        return 0
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def norm_int(v: Any) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def norm_bool(v: Any) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    if isinstance(v, str):
        return v.strip().lower() in ("1", "true", "yes", "on")
    return False


def parse_domain_names(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except json.JSONDecodeError:
            return [part.strip() for part in value.split(",") if part.strip()]
    return []


def normalize_domains(domains: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for domain in domains:
        norm = domain.strip().lower()
        if not norm or norm in seen:
            continue
        seen.add(norm)
        out.append(norm)
    return out


def certificate_covers_domains(certificate: dict[str, Any], domains: list[str]) -> bool:
    cert_domains = set(normalize_domains(parse_domain_names(certificate.get("domain_names"))))
    required = set(normalize_domains(domains))
    return bool(required) and required.issubset(cert_domains)


def ensure_certificate(
    base: str,
    token: str,
    *,
    domains: list[str],
    letsencrypt_email: str,
) -> int:
    normalized_domains = normalize_domains(domains)
    certificates = request_json("GET", f"{base}/api/nginx/certificates", token=token)
    if not isinstance(certificates, list):
        raise RuntimeError(f"Unexpected certificates list: {certificates!r}")

    for certificate in certificates:
        if not isinstance(certificate, dict):
            continue
        cid = norm_int(certificate.get("id"))
        if cid <= 0:
            continue
        if certificate_covers_domains(certificate, normalized_domains):
            print(
                f"[npm-bootstrap] Reusing certificate id={cid} for "
                f"{', '.join(normalized_domains)}"
            )
            return cid

    body = {
        "provider": "letsencrypt",
        "domain_names": normalized_domains,
        "meta": {
            "letsencrypt_email": letsencrypt_email,
            "letsencrypt_agree": True,
        },
    }
    created = request_json(
        "POST", f"{base}/api/nginx/certificates", body=body, token=token
    )
    if not isinstance(created, dict):
        raise RuntimeError(f"Unexpected certificate create response: {created!r}")
    cid = norm_int(created.get("id"))
    if cid <= 0:
        raise RuntimeError(f"Certificate create did not return a valid id: {created!r}")
    print(
        f"[npm-bootstrap] Created Let's Encrypt certificate id={cid} for "
        f"{', '.join(normalized_domains)}"
    )
    return cid


def build_put_body(
    full: dict[str, Any],
    *,
    forward_scheme: str,
    forward_host: str,
    forward_port: int,
    advanced_config: str,
    certificate_id: int,
    ssl_forced: bool,
    hsts_enabled: bool,
    hsts_subdomains: bool,
) -> dict[str, Any]:
    keys = [
        "domain_names",
        "forward_scheme",
        "forward_host",
        "forward_port",
        "certificate_id",
        "ssl_forced",
        "hsts_enabled",
        "hsts_subdomains",
        "http2_support",
        "block_exploits",
        "caching_enabled",
        "allow_websocket_upgrade",
        "access_list_id",
        "advanced_config",
        "enabled",
        "meta",
        "locations",
    ]
    out: dict[str, Any] = {"id": full["id"]}
    for k in keys:
        if k in full:
            out[k] = full[k]
    out["forward_scheme"] = forward_scheme
    out["forward_host"] = forward_host
    out["forward_port"] = forward_port
    out["certificate_id"] = certificate_id
    out["ssl_forced"] = ssl_forced
    out["hsts_enabled"] = hsts_enabled
    out["hsts_subdomains"] = hsts_subdomains
    out["advanced_config"] = advanced_config
    out["enabled"] = True
    if out.get("meta") is None:
        out["meta"] = {}
    if out.get("locations") is None:
        out["locations"] = []
    return out


def upstream_matches(
    row: dict[str, Any],
    *,
    forward_scheme: str,
    forward_host: str,
    forward_port: int,
    advanced_config: str,
    certificate_id: int,
    ssl_forced: bool,
    hsts_enabled: bool,
    hsts_subdomains: bool,
) -> bool:
    if (row.get("forward_scheme") or "").lower() != forward_scheme.lower():
        return False
    if (row.get("forward_host") or "") != forward_host:
        return False
    if norm_port(row.get("forward_port")) != forward_port:
        return False
    if norm_int(row.get("certificate_id")) != certificate_id:
        return False
    if norm_bool(row.get("ssl_forced")) != ssl_forced:
        return False
    if norm_bool(row.get("hsts_enabled")) != hsts_enabled:
        return False
    if norm_bool(row.get("hsts_subdomains")) != hsts_subdomains:
        return False
    cur_adv = (row.get("advanced_config") or "").strip()
    if cur_adv != advanced_config.strip():
        return False
    return True


def ensure_proxy_host(
    base: str,
    token: str,
    *,
    domain: str,
    forward_host: str,
    forward_port: int,
    advanced_config: str,
    certificate_id: int = 0,
    ssl_forced: bool = False,
    hsts_enabled: bool = False,
    hsts_subdomains: bool = False,
) -> None:
    forward_scheme = "http"
    hosts = request_json("GET", f"{base}/api/nginx/proxy-hosts", token=token)
    if not isinstance(hosts, list):
        raise RuntimeError(f"Unexpected proxy-hosts list: {hosts!r}")

    existing = find_host_for_domain(hosts, domain)
    if existing:
        hid = int(existing["id"])
        if upstream_matches(
            existing,
            forward_scheme=forward_scheme,
            forward_host=forward_host,
            forward_port=forward_port,
            advanced_config=advanced_config,
            certificate_id=certificate_id,
            ssl_forced=ssl_forced,
            hsts_enabled=hsts_enabled,
            hsts_subdomains=hsts_subdomains,
        ):
            print(f"[npm-bootstrap] Proxy host for {domain!r} already correct — skip")
            return

        print(
            f"[npm-bootstrap] Fixing proxy host id={hid} for {domain!r} "
            f"(was {existing.get('forward_scheme')}://{existing.get('forward_host')}:"
            f"{existing.get('forward_port')} → {forward_scheme}://{forward_host}:{forward_port})"
        )
        full = request_json("GET", f"{base}/api/nginx/proxy-hosts/{hid}", token=token)
        if not isinstance(full, dict):
            raise RuntimeError(f"Unexpected GET proxy-host: {full!r}")
        body = build_put_body(
            full,
            forward_scheme=forward_scheme,
            forward_host=forward_host,
            forward_port=forward_port,
            advanced_config=advanced_config,
            certificate_id=certificate_id,
            ssl_forced=ssl_forced,
            hsts_enabled=hsts_enabled,
            hsts_subdomains=hsts_subdomains,
        )
        request_json(
            "PUT",
            f"{base}/api/nginx/proxy-hosts/{hid}",
            body=body,
            token=token,
        )
        print(f"[npm-bootstrap] Updated proxy host for {domain!r}")
        return

    body: dict[str, Any] = {
        "domain_names": [domain],
        "forward_scheme": forward_scheme,
        "forward_host": forward_host,
        "forward_port": forward_port,
        "certificate_id": certificate_id,
        "ssl_forced": ssl_forced,
        "hsts_enabled": hsts_enabled,
        "hsts_subdomains": hsts_subdomains,
        "http2_support": True,
        "block_exploits": True,
        "caching_enabled": False,
        "allow_websocket_upgrade": True,
        "access_list_id": 0,
        "advanced_config": advanced_config,
        "enabled": True,
        "meta": {},
        "locations": [],
    }
    try:
        created = request_json(
            "POST", f"{base}/api/nginx/proxy-hosts", body=body, token=token
        )
    except RuntimeError as e:
        if "already in use" in str(e).lower():
            print(
                f"[npm-bootstrap] Domain {domain!r} already registered in NPM — "
                "re-fetch and run again to repair upstream"
            )
            return
        raise
    print(f"[npm-bootstrap] Created proxy host for {domain!r}: id={created.get('id')!r}")


def wait_for_npm(base: str, attempts: int = 90, delay: float = 2.0) -> None:
    for i in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(f"{base}/", timeout=5.0) as resp:
                if 200 <= resp.status < 600:
                    print("[npm-bootstrap] NPM admin port is reachable")
                    return
        except urllib.error.HTTPError as e:
            if e.code < 500:
                print("[npm-bootstrap] NPM admin port is reachable")
                return
            print(
                f"[npm-bootstrap] Waiting for NPM ({i}/{attempts}): HTTP {e.code}",
                file=sys.stderr,
            )
            time.sleep(delay)
        except Exception as e:
            print(f"[npm-bootstrap] Waiting for NPM ({i}/{attempts}): {e}", file=sys.stderr)
            time.sleep(delay)
    raise SystemExit("[npm-bootstrap] NPM did not become ready in time")


def main() -> None:
    if env("NPM_DISABLE_BOOTSTRAP", "0").lower() in ("1", "true", "yes"):
        print("[npm-bootstrap] Disabled (NPM_DISABLE_BOOTSTRAP)")
        return

    base = (env("NPM_INTERNAL_URL") or "http://nginx-proxy-manager:81").rstrip("/")
    email = env("NPM_ADMIN_EMAIL", "admin@example.com")
    password = env("NPM_ADMIN_PASSWORD", "")
    use_default = env("NPM_USE_DEFAULT_CREDENTIALS", "0") in ("1", "true", "yes")

    if not password:
        if use_default:
            password = "changeme"
        else:
            print(
                "[npm-bootstrap] Skipping: set NPM_ADMIN_PASSWORD or NPM_USE_DEFAULT_CREDENTIALS=1",
                file=sys.stderr,
            )
            sys.exit(0)

    wait_for_npm(base)

    token_payload = request_json(
        "POST",
        f"{base}/api/tokens",
        body={"identity": email, "secret": password, "scope": "user"},
        token=None,
    )
    token = parse_token(token_payload)

    store_domain = env("NPM_STOREFRONT_DOMAIN", "ecommerce.harshildex.com")
    api_domain = env("NPM_API_DOMAIN", "backend.ecommerce.harshildex.com")
    portainer_domain = env("NPM_PORTAINER_DOMAIN", "portainer.harshildex.com")
    fh_s = env("NPM_FORWARD_STOREFRONT", "frontend")
    fp_s = int(env("NPM_FORWARD_STOREFRONT_PORT", "80") or "80")
    fh_a = env("NPM_FORWARD_API", "backend")
    fp_a = int(env("NPM_FORWARD_API_PORT", "5000") or "5000")
    fh_p = env("NPM_FORWARD_PORTAINER", "portainer")
    fp_p = int(env("NPM_FORWARD_PORTAINER_PORT", "9000") or "9000")
    tls_email = env("NPM_LETSENCRYPT_EMAIL")
    if tls_email is None and email and email.lower() != "admin@example.com":
        tls_email = email
    want_tls = env_bool("NPM_AUTO_TLS", tls_email is not None)
    force_ssl = env_bool("NPM_FORCE_SSL", True)
    hsts_enabled = env_bool("NPM_HSTS_ENABLED", False)
    hsts_subdomains = env_bool("NPM_HSTS_SUBDOMAINS", False)
    certificate_id = 0

    cert_domains = [store_domain, api_domain]
    if portainer_domain:
        cert_domains.append(portainer_domain)

    if want_tls:
        if not tls_email:
            print(
                "[npm-bootstrap] TLS requested but no real email is configured. "
                "Set NPM_LETSENCRYPT_EMAIL or a non-placeholder NPM_ADMIN_EMAIL.",
                file=sys.stderr,
            )
        else:
            certificate_id = ensure_certificate(
                base,
                token,
                domains=cert_domains,
                letsencrypt_email=tls_email,
            )

    host_ssl_forced = bool(certificate_id and force_ssl)
    host_hsts_enabled = bool(certificate_id and hsts_enabled)
    host_hsts_subdomains = bool(certificate_id and hsts_subdomains)

    ensure_proxy_host(
        base,
        token,
        domain=store_domain,
        forward_host=fh_s,
        forward_port=fp_s,
        advanced_config=storefront_advanced_config(fh_a, fp_a),
        certificate_id=certificate_id,
        ssl_forced=host_ssl_forced,
        hsts_enabled=host_hsts_enabled,
        hsts_subdomains=host_hsts_subdomains,
    )
    ensure_proxy_host(
        base,
        token,
        domain=api_domain,
        forward_host=fh_a,
        forward_port=fp_a,
        advanced_config=ADVANCED_API,
        certificate_id=certificate_id,
        ssl_forced=host_ssl_forced,
        hsts_enabled=host_hsts_enabled,
        hsts_subdomains=host_hsts_subdomains,
    )
    if portainer_domain:
        ensure_proxy_host(
            base,
            token,
            domain=portainer_domain,
            forward_host=fh_p,
            forward_port=fp_p,
            advanced_config="",
            certificate_id=certificate_id,
            ssl_forced=host_ssl_forced,
            hsts_enabled=host_hsts_enabled,
            hsts_subdomains=host_hsts_subdomains,
        )
    print("[npm-bootstrap] Done")


if __name__ == "__main__":
    main()
