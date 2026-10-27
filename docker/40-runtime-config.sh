#!/bin/sh
set -eu

# Write /tmp/config.js from the SUPABASE_URL and SUPABASE_ANON_KEY env vars.
# Each value is JSON-escaped so a bad value cannot break out of the string or
# inject script. Only whether each var is set is printed, never the value.

# JSON-escape a single value. Handles backslash, double quote, tab, newline,
# other control characters, and < (escaped as \u003c so it can never close a
# script context).
json_escape() {
    s="$1"
    out=""
    while [ -n "$s" ]; do
        c="${s%"${s#?}"}"
        s="${s#?}"
        code=$(printf '%d' "'$c")
        case "$code" in
            92) out="${out}\\\\" ;;     # backslash
            34) out="${out}\\\"" ;;     # double quote
            9)  out="${out}\\t" ;;      # tab
            10) out="${out}\\n" ;;      # newline
            60) out="${out}\\u003c" ;;  # <
            *)
                if [ "$code" -gt 0 ] && [ "$code" -lt 32 ]; then
                    out="${out}\\u$(printf '%04x' "$code")"
                else
                    out="${out}${c}"
                fi
                ;;
        esac
    done
    printf '%s' "$out"
}

url="${SUPABASE_URL:-}"
anon_key="${SUPABASE_ANON_KEY:-}"

if [ -n "$url" ]; then
    echo "SUPABASE_URL: set"
else
    echo "SUPABASE_URL: unset"
fi

if [ -n "$anon_key" ]; then
    echo "SUPABASE_ANON_KEY: set"
else
    echo "SUPABASE_ANON_KEY: unset"
fi

escaped_url="$(json_escape "$url")"
escaped_anon_key="$(json_escape "$anon_key")"

printf 'window.__NUVIO_CONFIG__ = {"SUPABASE_URL":"%s","SUPABASE_ANON_KEY":"%s"};\n' \
    "$escaped_url" "$escaped_anon_key" > /tmp/config.js
