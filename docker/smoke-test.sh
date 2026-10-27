#!/bin/sh
set -eu

# Smoke test for the Nuvio Manager container image.
# Usage: sh docker/smoke-test.sh <image>
#
# Runs the image on a free host port, waits for /healthz, then asserts the
# nginx config, the entrypoint-generated /config.js, the security headers and
# the non-root user. A second run with hostile env values proves the config
# values round-trip as valid JSON. Always removes its containers on exit and
# exits non-zero on the first failed assertion.
#
# SMOKE_HOST is the host the test talks to (default localhost). When the test
# itself runs inside a container, set it to the host (e.g. host.docker.internal).

image="$1"

host="${SMOKE_HOST:-localhost}"
port1="${SMOKE_PORT1:-18095}"
port2="${SMOKE_PORT2:-18096}"

c1=""
c2=""

cleanup() {
    if [ -n "$c1" ]; then
        docker rm -f "$c1" >/dev/null 2>&1 || true
    fi
    if [ -n "$c2" ]; then
        docker rm -f "$c2" >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

fail() {
    echo "SMOKE TEST FAILED: $1" >&2
    exit 1
}

wait_healthz() {
    host_port="$1"
    i=0
    while [ "$i" -lt 20 ]; do
        code=$(curl -s -o /dev/null -w '%{http_code}' "http://$host:$host_port/healthz" 2>/dev/null || echo "000")
        if [ "$code" = "200" ]; then
            return 0
        fi
        i=$((i + 1))
        sleep 1
    done
    fail "container did not serve /healthz on $host:$host_port within 20 s"
}

echo "=== run 1: $image on $host:$port1 ==="
c1=$(docker run -d -p "$port1:8080" "$image")
wait_healthz "$port1"

# GET / is 200 and contains <div id="root">
status=$(curl -s -o /dev/null -w '%{http_code}' "http://$host:$port1/")
[ "$status" = "200" ] || fail "GET / returned $status, expected 200"
index_html=$(curl -s "http://$host:$port1/")
printf '%s' "$index_html" | grep -q '<div id="root">' || fail "GET / does not contain <div id=\"root\">"

# GET /healthz is 200 and "ok"
status=$(curl -s -o /dev/null -w '%{http_code}' "http://$host:$port1/healthz")
[ "$status" = "200" ] || fail "GET /healthz returned $status, expected 200"
body=$(curl -s "http://$host:$port1/healthz")
[ "$body" = "ok" ] || fail "GET /healthz body was '$body', expected 'ok'"

# GET /config.js is 200 and contains __NUVIO_CONFIG__
status=$(curl -s -o /dev/null -w '%{http_code}' "http://$host:$port1/config.js")
[ "$status" = "200" ] || fail "GET /config.js returned $status, expected 200"
body=$(curl -s "http://$host:$port1/config.js")
printf '%s' "$body" | grep -q '__NUVIO_CONFIG__' || fail "GET /config.js does not contain __NUVIO_CONFIG__"

# GET /some/spa/route is 200 (SPA fallback)
status=$(curl -s -o /dev/null -w '%{http_code}' "http://$host:$port1/some/spa/route")
[ "$status" = "200" ] || fail "GET /some/spa/route returned $status, expected 200"

# GET /assets/<built js> is 200 with immutable
js_file=$(printf '%s' "$index_html" | grep -oE '/assets/[A-Za-z0-9._-]+\.js' | head -n 1)
[ -n "$js_file" ] || fail "could not find a built JS file in index.html"
status=$(curl -s -o /dev/null -w '%{http_code}' "http://$host:$port1$js_file")
[ "$status" = "200" ] || fail "GET $js_file returned $status, expected 200"
headers=$(curl -s -D - -o /dev/null "http://$host:$port1$js_file")
printf '%s' "$headers" | grep -qi 'immutable' || fail "GET $js_file headers do not contain immutable"

# Response headers contain the CSP and nosniff
headers=$(curl -s -D - -o /dev/null "http://$host:$port1/")
printf '%s' "$headers" | grep -qi 'content-security-policy' || fail "GET / headers do not contain Content-Security-Policy"
printf '%s' "$headers" | grep -qi 'x-content-type-options: nosniff' || fail "GET / headers do not contain X-Content-Type-Options: nosniff"

# GET /config.js is no-store
headers=$(curl -s -D - -o /dev/null "http://$host:$port1/config.js")
printf '%s' "$headers" | grep -qi 'cache-control: no-store' || fail "GET /config.js headers do not contain Cache-Control: no-store"

# The container runs as a non-root user
uid=$(docker exec "$c1" id -u)
[ "$uid" != "0" ] || fail "container runs as root (uid 0)"

echo "=== run 2: hostile env values on $host:$port2 ==="
c2=$(docker run -d -p "$port2:8080" -e 'SUPABASE_URL=https://x.example/"; alert(1)//' -e 'SUPABASE_ANON_KEY=a"b\c' "$image")
wait_healthz "$port2"

config=$(curl -s "http://$host:$port2/config.js")

node -e '
const raw = process.argv[1];
const json = raw.replace(/^window\.__NUVIO_CONFIG__\s*=\s*/, "").replace(/;\s*$/, "");
const obj = JSON.parse(json);
const expectedUrl = "https://x.example/\"; alert(1)//";
const expectedKey = "a\"b\\c";
if (obj.SUPABASE_URL !== expectedUrl) {
  console.error("SUPABASE_URL mismatch: " + JSON.stringify(obj.SUPABASE_URL));
  process.exit(1);
}
if (obj.SUPABASE_ANON_KEY !== expectedKey) {
  console.error("SUPABASE_ANON_KEY mismatch: " + JSON.stringify(obj.SUPABASE_ANON_KEY));
  process.exit(1);
}
console.log("round-trip OK");
' "$config"

echo "SMOKE TEST PASSED"
