#!/bin/zsh
set -euo pipefail

printf 'Paste your TMDB API Read Access Token (input is hidden): '
read -rs trove_tmdb_token
printf '\n'

if [[ -z "$trove_tmdb_token" ]]; then
  printf 'No token was entered; nothing changed.\n' >&2
  exit 1
fi

security add-generic-password -U -a "$(whoami)" -s 'trove-tmdb' -w "$trove_tmdb_token" >/dev/null
unset trove_tmdb_token
printf 'TMDB token saved in macOS Keychain for Anthology. Restart the app server to activate it.\n'
