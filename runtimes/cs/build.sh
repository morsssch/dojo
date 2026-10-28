#!/usr/bin/env bash
# Собирает C#-рантайм (Roslyn + .NET в WebAssembly) для запуска кода учеников в браузере и в npm run check.
# Результат: public/runtimes/cs/_framework (≈43 МБ; GitHub Pages отдаёт wasm сжатым, по сети ≈15 МБ).
# Нужен .NET SDK 10 (workload wasm-tools не обязателен).
set -euo pipefail
cd "$(dirname "$0")"
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1
OUT=../../public/runtimes/cs
rm -rf obj/publish-tmp "$OUT/_framework"
dotnet publish CsRunner.csproj -c Release -o obj/publish-tmp
mkdir -p "$OUT"
cp -r obj/publish-tmp/wwwroot/_framework "$OUT/"
# предсжатые копии не нужны: Pages сжимает сам, а заголовок Content-Encoding для них не выставить
find "$OUT/_framework" \( -name '*.br' -o -name '*.gz' \) -delete
du -sh "$OUT/_framework"
