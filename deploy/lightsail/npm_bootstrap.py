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
    NPM injects this before the default location / block. Routes storefront image/media
    paths straight to the API container (same Node app as backend.ecommerce.harshildex.com).
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

location ^~ /uploads {{
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


def build_put_body(
    full: dict[str, Any],
    *,
    forward_scheme: str,
    forward_host: str,
    forward_port: int,
    advanced_config: str,
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
) -> bool:
    if (row.get("forward_scheme") or "").lower() != forward_scheme.lower():
        return False
    if (row.get("forward_host") or "") != forward_host:
        return False
    if norm_port(row.get("forward_port")) != forward_port:
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
        "certificate_id": 0,
        "ssl_forced": False,
        "hsts_enabled": False,
        "hsts_subdomains": False,
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
    fh_s = env("NPM_FORWARD_STOREFRONT", "frontend")
    fp_s = int(env("NPM_FORWARD_STOREFRONT_PORT", "80") or "80")
    fh_a = env("NPM_FORWARD_API", "backend")
    fp_a = int(env("NPM_FORWARD_API_PORT", "5000") or "5000")

    ensure_proxy_host(
        base,
        token,
        domain=store_domain,
        forward_host=fh_s,
        forward_port=fp_s,
        advanced_config=storefront_advanced_config(fh_a, fp_a),
    )
    ensure_proxy_host(
        base,
        token,
        domain=api_domain,
        forward_host=fh_a,
        forward_port=fp_a,
        advanced_config=ADVANCED_API,
    )
    print("[npm-bootstrap] Done")


if __name__ == "__main__":
    main()
