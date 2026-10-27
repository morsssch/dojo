#!/usr/bin/env bash
# Собирает Go-интерпретатор (yaegi) в WebAssembly для запуска кода учеников в браузере.
# Результат: public/runtimes/go/{yaegi.wasm,wasm_exec.js}
# Набор пакетов стандартной библиотеки урезан, чтобы wasm весил меньше — список в PKGS.
set -euo pipefail
cd "$(dirname "$0")"
YAEGI_VERSION=v0.16.1
PKGS="bufio bytes cmp container_heap container_list context crypto_md5 crypto_sha1 crypto_sha256 crypto_rand crypto_hmac
encoding encoding_base64 encoding_hex encoding_json encoding_csv errors fmt hash hash_fnv io io_fs log log_slog
math math_bits math_rand reflect net_http net_http_httptest net_url os path path_filepath regexp sort strconv strings
sync sync_atomic text_template html time encoding_xml unicode unicode_utf8 maps slices"

go mod download github.com/traefik/yaegi@$YAEGI_VERSION
SRC="$(go env GOMODCACHE)/github.com/traefik/yaegi@$YAEGI_VERSION/stdlib"
rm -rf stdlib && mkdir stdlib
cp "$SRC/stdlib.go" "$SRC/wrapper-composed.go" "$SRC/restricted.go" stdlib/
for p in $PKGS; do
  for f in "$SRC/go1_21_$p.go" "$SRC/go1_22_$p.go"; do
    [ -f "$f" ] && cp "$f" stdlib/
  done
done
cp "$SRC/maptypes.go" stdlib/
chmod -R u+w stdlib

OUT=../../public/runtimes/go
mkdir -p "$OUT"
GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w" -o "$OUT/yaegi.wasm" .
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" "$OUT/" 2>/dev/null || cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" "$OUT/"
ls -la "$OUT"
