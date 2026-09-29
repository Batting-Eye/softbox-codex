#!/bin/sh
# Softbox MCP 서버를 켜요. 사용자 Mac에 Node가 없어도 되게 Codex에 들어 있는 Node부터 찾아요.
# 찾는 순서는 OpenAI 기본 플러그인(codex-app-tools)의 실행 스크립트와 같아요.
set -eu

if [ "$#" -lt 1 ]; then
  printf '%s\n' 'Softbox could not start: missing MCP server path.' >&2
  exit 64
fi

PATH="${PATH:-/usr/bin:/bin}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export PATH

cache_root=${XDG_CACHE_HOME:-${HOME:-}/.cache}
codex_resources=
case "${CODEX_CLI_PATH:-}" in
  */*) codex_resources=${CODEX_CLI_PATH%/*} ;;
esac
for candidate in \
  "${CODEX_MCP_NODE_PATH:-}" \
  "${CODEX_ELECTRON_RESOURCES_PATH:-}/cua_node/bin/node" \
  "$codex_resources/cua_node/bin/node" \
  "$cache_root/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    exec "$candidate" "$@"
  fi
done

if node_path=$(command -v node 2>/dev/null); then
  case "$node_path" in
    /*) exec "$node_path" "$@" ;;
  esac
fi

printf '%s\n' 'Softbox could not find a Node runtime. Update Codex or install Node 20+.' >&2
exit 127
