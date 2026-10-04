#!/usr/bin/env bash
# Secret scan over the repo and demo-web's browser-served build output (BATCH-06 step 3).
#
#   scan-secrets.sh            repo files (tracked + untracked, not ignored) and the demo-web build output
#   scan-secrets.sh DIR...     the given directories, recursively
#
# Exit 0: clean. Exit 1: hits, printed as file path plus the check that found it, never the match.
# Exit 2: misuse.
# Secret values come from the shell environment only, never from .env files.
set -euo pipefail

readonly SECRET_VARIABLES="SANITY_WRITE_TOKEN ASSETLAKE_SESSION_SECRET"
# Sanity tokens are "sk" plus well over 60 alphanumerics. The batch spec's floor of 20 matched Next's
# own runtime (taskAsyncStorageInstance, skipSelectionChangeEvent). The public-prefix half matches
# a variable name only: ".*" spanned prose and code on one minified line. [_] stops a self-match.
readonly TOKEN_PATTERN='sk[A-Za-z0-9]{60,}|NEXT_PUBLIC[_][A-Z0-9_]*TOKEN'
readonly VALUE_CHECK="secret value"
readonly PATTERN_CHECK="token pattern"
# Lockfile sha512 integrity hashes contain sk-runs. Literal secret values are still checked there.
readonly PATTERN_EXEMPT_FILE="pnpm-lock.yaml"
readonly STATIC_OUTPUT="apps/demo-web/.next/static"
readonly PRERENDERED_OUTPUT="apps/demo-web/.next/server/app"

fail_usage() {
  echo "scan-secrets: $1" >&2
  exit 2
}

require_secrets() {
  local name
  for name in $SECRET_VARIABLES; do
    # An empty pattern line would make grep -f match everything, and a missing value would make
    # the literal check silently pass, so both fail closed.
    [ -n "${!name:-}" ] || fail_usage "$name must be set (non-empty) in the shell environment"
  done
  if [[ $SANITY_WRITE_TOKEN == sk* && ! $SANITY_WRITE_TOKEN =~ $TOKEN_PATTERN ]]; then
    echo "scan-secrets: warning: SANITY_WRITE_TOKEN is shorter than the token pattern's floor;" \
      "the pattern check would miss tokens of its shape" >&2
  fi
}

# printf is a builtin and grep reads the values through a pipe, so they never appear in argv or ps.
print_secrets() {
  local name
  for name in $SECRET_VARIABLES; do
    printf '%s\n' "${!name}"
  done
}

# grep and git grep exit 1 for "no match"; only exit codes above 1 are real failures.
# Each matching path is printed with the name of the check that found it.
run_grep() {
  local check="$1" status=0 paths
  shift
  paths="$("$@")" || status=$?
  [ "$status" -le 1 ] || fail_usage "search failed (exit $status)"
  [ -z "$paths" ] || printf '%s\n' "$paths" | sed "s/\$/  ($check)/"
}

count_files() {
  local directory="$1"
  shift
  find "$directory" -type f ${1+"$@"} | wc -l | tr -d ' '
}

# Prints files under a directory that hold a secret value or a token-shaped string.
grep_tree() {
  local directory="$1"
  shift
  run_grep "$VALUE_CHECK" grep -rIlF --exclude-dir=node_modules --exclude-dir=.git ${1+"$@"} \
    -f <(print_secrets) -- "$directory"
  run_grep "$PATTERN_CHECK" grep -rIlE --exclude-dir=node_modules --exclude-dir=.git ${1+"$@"} \
    --exclude="$PATTERN_EXEMPT_FILE" -e "$TOKEN_PATTERN" -- "$directory"
}

scan_dirs() {
  local directory
  for directory in "$@"; do
    [ -d "$directory" ] || fail_usage "not a directory: $directory"
  done
  for directory in "$@"; do
    grep_tree "$directory"
  done
  echo "scan-secrets: scanned $# director$([ "$#" -eq 1 ] && echo y || echo ies)" >&2
}

# git grep covers exactly the files that could ever be committed, so .env.local, docs/,
# node_modules and .next stay out of the repo half of the scan.
scan_repo() {
  run_grep "$VALUE_CHECK" git grep --untracked -I -l -F -f <(print_secrets)
  run_grep "$PATTERN_CHECK" git grep --untracked -I -l -E -e "$TOKEN_PATTERN" -- . \
    ":(exclude,glob)**/$PATTERN_EXEMPT_FILE"
}

# Static chunks plus prerendered HTML and RSC payloads: everything a browser can download.
scan_build_output() {
  if [ ! -d "$STATIC_OUTPUT" ]; then
    echo "scan-secrets: build output not found: run pnpm build first" >&2
    return
  fi
  grep_tree "$STATIC_OUTPUT"
  if [ -d "$PRERENDERED_OUTPUT" ]; then
    grep_tree "$PRERENDERED_OUTPUT" --include='*.html' --include='*.rsc'
  fi
}

describe_build_output() {
  if [ ! -d "$STATIC_OUTPUT" ]; then
    echo ".next/static (skipped), prerendered (skipped)"
    return
  fi
  local prerendered=0
  if [ -d "$PRERENDERED_OUTPUT" ]; then
    prerendered="$(count_files "$PRERENDERED_OUTPUT" \( -name '*.html' -o -name '*.rsc' \))"
  fi
  echo ".next/static ($(count_files "$STATIC_OUTPUT") files), prerendered (${prerendered} files)"
}

scan_repo_and_build_output() {
  local root
  root="$(git rev-parse --show-toplevel 2>/dev/null)" ||
    fail_usage "not inside a git repository: pass directories to scan instead"
  cd "$root"
  scan_repo
  scan_build_output
  local repo_files
  repo_files="$(git ls-files -co --exclude-standard | wc -l | tr -d ' ')"
  echo "scan-secrets: scanned repo (${repo_files} files), $(describe_build_output)" >&2
}

main() {
  require_secrets
  local hits
  if [ "$#" -gt 0 ]; then
    hits="$(scan_dirs "$@")"
  else
    hits="$(scan_repo_and_build_output)"
  fi
  if [ -n "$hits" ]; then
    echo "scan-secrets: secret-like content found in:" >&2
    printf '%s\n' "$hits" | sort -u
    exit 1
  fi
  echo "scan-secrets: clean" >&2
}

main "$@"
