#!/usr/bin/env bash
# Copy the plugin to Paseo daemons over SSH and install or reload it there, so every host runs
# this checkout. Prints each host's plugin status, whether its copy matches this checkout, and
# whether the host has its Postgram config file.
# Usage: scripts/deploy.sh [--check] [host ...]   ("local" means this machine's daemon)
#   --check   only report; change nothing
set -euo pipefail

PLUGIN_ID="paseo-postgram-tasks"
REMOTE_DIR="src/$PLUGIN_ID"
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# Hosts and SSH options live in an untracked file next to this script:
#   HOSTS=(local host-a host-b)          # "local" is this machine's daemon
#   SSH_OPTS=(-o BatchMode=yes)
HOSTS=(local)
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10)
LOCAL_CONFIG="$(dirname "$0")/deploy.local"
# shellcheck source=/dev/null
[ -f "$LOCAL_CONFIG" ] && source "$LOCAL_CONFIG"

check_only=0
if [ "${1:-}" = --check ]; then
  check_only=1
  shift
fi
hosts=("$@")
[ ${#hosts[@]} -eq 0 ] && hosts=("${HOSTS[@]}")

# The shipped files, NUL-separated, relative to the plugin directory. Used both to build the
# tarball and to hash a copy, so the hash covers exactly what is deployed.
# (The remote snippets below are wrapped in single quotes, so they must not contain any.)
LIST_FILES='find . -type f ! -path "./node_modules/*" ! -path "./.git/*" ! -path "./.superpowers/*" ! -path "./scripts/deploy.local" -print0 | LC_ALL=C sort -z'

# Installs on first deploy, reloads afterwards.
INSTALL_OR_RELOAD='
  dir="$1"; id="$2"
  if paseo plugin ls 2>/dev/null | grep -q "^$id "; then
    paseo plugin reload "$id" >/dev/null
  else
    paseo plugin install "$dir" >/dev/null
  fi
  sleep 2
'

# Prints "<status> <source hash> <config>" for the plugin copy in $1.
REPORT='
  dir="$1"; id="$2"
  status=$(paseo plugin ls 2>/dev/null | awk -v id="$id" "\$1 == id { print \$2 }")
  hash=none
  if [ -d "$dir" ]; then
    if command -v sha256sum >/dev/null; then sum=sha256sum; else sum="shasum -a 256"; fi
    hash=$(cd "$dir" && '"$LIST_FILES"' | xargs -0 $sum | $sum | cut -c1-12)
  fi
  config="${PASEO_HOME:-$HOME/.paseo}/postgram-tasks.json"
  if [ -f "$config" ]; then config=config-ok; else config="config-missing:$config"; fi
  echo "${status:-not-installed} $hash $config"
'

# Headscale SSH can hold a connection until someone approves it in a browser, which would stall the
# deploy silently. Try each remote host first with a time limit and show the approval link instead.
PREFLIGHT_SECONDS=15
preflight() {
  local host=$1 log pid url
  log=$(mktemp)
  ssh "${SSH_OPTS[@]}" "$host" true >"$log" 2>&1 </dev/null &
  pid=$!
  for _ in $(seq 1 $((PREFLIGHT_SECONDS * 2))); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.5
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null
    wait "$pid" 2>/dev/null
    url=$(grep -o 'https://[^ ]*' "$log" | head -1)
    rm -f "$log"
    echo "${url:-no answer within ${PREFLIGHT_SECONDS}s}"
    return 1
  fi
  rm -f "$log"
}

expected=$(bash -c "$REPORT" _ "$SOURCE_DIR" "$PLUGIN_ID" | awk '{ print $2 }')
echo "this checkout: $expected"

failed=0
for host in "${hosts[@]}"; do
  if [ "$host" != local ] && ! waiting=$(preflight "$host"); then
    printf '%-10s %s\n' "$host" "needs-approval $waiting"
    failed=1
    continue
  fi
  if [ "$host" = local ]; then
    [ $check_only = 1 ] || bash -c "$INSTALL_OR_RELOAD" _ "$SOURCE_DIR" "$PLUGIN_ID" >/dev/null 2>&1 || true
    report=$(bash -c "$REPORT" _ "$SOURCE_DIR" "$PLUGIN_ID" 2>&1 | tail -1) || true
  elif [ $check_only = 1 ]; then
    report=$(
      ssh "${SSH_OPTS[@]}" "$host" "bash -c '$REPORT' _ ~/$REMOTE_DIR $PLUGIN_ID" 2>&1 </dev/null | tail -1
    ) || true
  else
    report=$(
      cd "$SOURCE_DIR" && bash -c "$LIST_FILES" |
        COPYFILE_DISABLE=1 tar --null -T - -czf - |
        ssh "${SSH_OPTS[@]}" "$host" \
          "rm -rf ~/$REMOTE_DIR && mkdir -p ~/$REMOTE_DIR && tar -xzf - -C ~/$REMOTE_DIR 2>/dev/null
           bash -c '$INSTALL_OR_RELOAD' _ ~/$REMOTE_DIR $PLUGIN_ID >/dev/null 2>&1
           bash -c '$REPORT' _ ~/$REMOTE_DIR $PLUGIN_ID" 2>&1 | tail -1
    ) || true
  fi

  status=no-response hash="" config=""
  [[ "${report:-}" =~ ^[a-z-]+\ (none|[0-9a-f]{12})\ config- ]] && read -r status hash config <<<"$report"
  if [ "$hash" = "$expected" ]; then version=current; else version="stale:${hash:-?}"; fi
  printf '%-10s %-14s %-20s %s\n' "$host" "$status" "$version" "$config"
  [ "$status" = no-response ] && echo "           ${report:-}"
  [ "$status" = running ] && [ "$version" = current ] || failed=1
done
exit $failed
