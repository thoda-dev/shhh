#!/bin/sh
#
# One-command install for a self-hosted shhh instance. Asks what it needs, generates the secrets,
# writes a .env, and starts the stack.
#
#   curl -fsSLO https://raw.githubusercontent.com/thoda-dev/shhh/master/install.sh
#   less install.sh && sh install.sh
#
# `curl -fsSL … | sh` works too, since the prompts read from /dev/tty rather than stdin, but reading a script that generates secrets before running it is the better habit.
#
# Non-interactive (cloud-init, Ansible, CI) — set what you want and it stops asking:
#   BETTER_AUTH_URL         public HTTPS address of the instance, no trailing slash
#   SHHH_BUNDLED_DB         1 to use the PostgreSQL from the compose file, 0 for your own
#   DATABASE_URL            connection string, required only when SHHH_BUNDLED_DB=0
#   SHHH_PROXY_DEPTH        proxies you control in front of the app (default: 1 for https, else 0)
#   TURNSTILE_SITE_KEY      Cloudflare Turnstile site key
#   TURNSTILE_SECRET_KEY    Cloudflare Turnstile secret key
#   SHHH_START              1 to start the stack, 0 to only write the files
#   SHHH_REF                git ref to fetch from (default: master)

set -eu

REF="${SHHH_REF:-master}"
RAW_BASE="${SHHH_RAW_BASE:-https://raw.githubusercontent.com/thoda-dev/shhh/$REF}"

say() { printf '\033[1m==>\033[0m %s\n' "$1"; }
note() { printf '    %s\n' "$1"; }
warn() { printf '\033[33m warn\033[0m %s\n' "$1" >&2; }
die() { printf '\033[31merror\033[0m %s\n' "$1" >&2; exit 1; }

# Opening /dev/tty is the only reliable test: `[ -r /dev/tty ]` answers yes under cron or cloud-init, then the open fails with ENXIO.
interactive() { (exec 3>/dev/tty) 2>/dev/null; }

# Prompts must come from the terminal, not from stdin: stdin is the script itself under `curl | sh`.
ask() { # ask <prompt> <default>
  _default="${2:-}"
  _answer=''
  if interactive; then
    if [ -n "$_default" ]; then printf '\033[1m?\033[0m %s [%s]: ' "$1" "$_default" > /dev/tty
    else printf '\033[1m?\033[0m %s: ' "$1" > /dev/tty; fi
    read -r _answer < /dev/tty || _answer=''
  fi
  if [ -n "$_answer" ]; then printf '%s' "$_answer"; else printf '%s' "$_default"; fi
}

yes_no() { # yes_no <answer>: 0 for yes, 1 for no
  case "$1" in y | Y | yes | YES | o | O | oui | 1 | true) return 0 ;; *) return 1 ;; esac
}

# A connection string carries the database password, so it is never echoed as given.
redact() { printf '%s' "$1" | sed -e 's|://[^:/@]*:[^@]*@|://***:***@|'; }

# ------------------------------------------------------------------ preflight

command -v curl >/dev/null 2>&1 || die 'curl is required.'
command -v docker >/dev/null 2>&1 || die 'docker is required — see https://docs.docker.com/engine/install/'
docker compose version >/dev/null 2>&1 || die 'docker compose v2 is required (the plugin, not docker-compose).'

# Refusing rather than overwriting: regenerating BETTER_AUTH_SECRET signs everybody out, and a new POSTGRES_PASSWORD never reaches an initialised volume, so the app would just stop connecting.
[ -e .env ] && die 'a .env already exists here. Move it aside first, or run this in an empty directory.'

if command -v openssl >/dev/null 2>&1; then
  rand_b64() { openssl rand -base64 32; }
  rand_hex() { openssl rand -hex 24; }
elif [ -r /dev/urandom ]; then
  rand_b64() { head -c 32 /dev/urandom | base64 | tr -d '\n'; }
  rand_hex() { head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
else
  die 'no source of randomness: install openssl, or make /dev/urandom readable.'
fi

printf '\n'
say 'shhh — self-hostable zero-knowledge pastebin'
interactive || note 'No terminal: falling back to the environment and to defaults.'
printf '\n'

# ------------------------------------------------------------------ questions

PUBLIC_URL="${BETTER_AUTH_URL:-$(ask 'Public URL of the instance, no trailing slash' 'https://shhh.example.com')}"

printf '\n'
note 'Rate limiting, the IP allow/blocklist and automatic bans all key on the address a request'
note 'really came from. Count the proxies you control in front of this app: 0 if it is exposed'
note 'directly, 1 behind a single nginx/Caddy/Traefik, 2 behind Cloudflare plus your own proxy.'
note 'Too low and one proxy IP absorbs everyone rate limit; too high and a caller picks their own.'
printf '\n'

# An https URL means something terminates TLS in front, since the app itself only speaks plain HTTP.
case "$PUBLIC_URL" in
  https://*) PROXY_DEFAULT=1 ;;
  *) PROXY_DEFAULT=0 ;;
esac
PROXY_DEPTH="${SHHH_PROXY_DEPTH:-$(ask 'Trusted proxies in front of the app' "$PROXY_DEFAULT")}"
case "$PROXY_DEPTH" in
  '' | *[!0-9]*) die "the number of trusted proxies must be a whole number, got '$PROXY_DEPTH'." ;;
esac

# The bundled database is the point of the compose file, so it is the default. Answering no is for a cluster you already back up and monitor.
if [ -n "${SHHH_BUNDLED_DB:-}" ]; then
  BUNDLED="$SHHH_BUNDLED_DB"
else
  BUNDLED=$(ask 'Use the PostgreSQL bundled in the compose file? (y/n)' 'y')
fi

if yes_no "$BUNDLED"; then
  USE_BUNDLED=1
  # Nothing to ask: the password is generated below and written to both the variable that initialises the database and the one the app connects with.
  DB_URL=''
else
  USE_BUNDLED=0
  DB_URL="${DATABASE_URL:-$(ask 'Connection string for your PostgreSQL' '')}"
  [ -n "$DB_URL" ] || die 'a connection string is required when not using the bundled database.'
fi

printf '\n'
note 'Cloudflare Turnstile guards paste creation, and the server rejects any creation without a'
note 'valid token — signed-in users included. Left empty, the instance runs but nobody can create'
note 'anything. Get a pair at https://dash.cloudflare.com/?to=/:account/turnstile and add this'
note "host to the widget's allowed hostnames."
printf '\n'

TS_SITE="${TURNSTILE_SITE_KEY:-$(ask 'Turnstile site key' '')}"
TS_SECRET="${TURNSTILE_SECRET_KEY:-$(ask 'Turnstile secret key' '')}"

# ------------------------------------------------------------------ fetch

printf '\n'
say "Fetching docker-compose.yml and .env.example ($REF)"
curl -fsSL "$RAW_BASE/docker/docker-compose.yml" -o docker-compose.yml \
  || die "could not fetch docker-compose.yml from $RAW_BASE"
curl -fsSL "$RAW_BASE/.env.example" -o .env \
  || die "could not fetch .env.example from $RAW_BASE"
chmod 600 .env

# ------------------------------------------------------------------ write .env

# `sed -i.bak` then removing the backup is the one in-place form both GNU and BSD sed accept.
# `|` is the delimiter because no value here can contain it, and `&` is escaped because sed expands it to the whole match.
set_env() { # set_env <key> <value>
  _esc=$(printf '%s' "$2" | sed -e 's|[&\\]|\\&|g')
  sed -i.bak "s|^$1=.*|$1=$_esc|" .env
  rm -f .env.bak
}

say 'Generating secrets'
set_env BETTER_AUTH_SECRET "$(rand_b64)"
set_env BETTER_AUTH_URL "$PUBLIC_URL"
set_env TRUSTED_PROXY_DEPTH "$PROXY_DEPTH"
# Unlocks two read-only fields on /api/health. Generated rather than left blank so the operator can
# point a dashboard at it later without regenerating anything; leaving it empty is equally valid.
set_env HEALTH_TOKEN "$(rand_hex)"
set_env NUXT_PUBLIC_TURNSTILE_SITE_KEY "$TS_SITE"
set_env NUXT_TURNSTILE_SECRET_KEY "$TS_SECRET"

if [ "$USE_BUNDLED" -eq 1 ]; then
  # Hex, so it needs no escaping inside the connection string. POSTGRES_PASSWORD initialises the database, DATABASE_URL is how the app reaches it.
  PG_PASSWORD=$(rand_hex)
  set_env POSTGRES_PASSWORD "$PG_PASSWORD"
  set_env DATABASE_URL "postgres://shhh:$PG_PASSWORD@db:5432/shhh"
else
  set_env DATABASE_URL "$DB_URL"
  # An override rather than an edit: `!reset` drops an inherited key, so the bundled database is neither started nor waited for and the fetched compose file stays byte-for-byte the published one.
  cat > docker-compose.override.yml <<'EOF'
# Written by install.sh: this instance uses an external PostgreSQL, so the bundled service is removed. Delete this file to go back to the bundled database.
services:
  app:
    depends_on: !reset null
  db: !reset null
EOF
  say 'Wrote docker-compose.override.yml — bundled database disabled'
fi

# ------------------------------------------------------------------ summary

printf '\n'
say 'Ready'
note "URL         $PUBLIC_URL"
if [ "$USE_BUNDLED" -eq 1 ]; then
  note 'Database    bundled, password generated'
else
  note "Database    external, $(redact "$DB_URL")"
fi
if [ "$PROXY_DEPTH" -eq 0 ]; then
  note 'Proxies     none trusted, using the connection address'
else
  note "Proxies     $PROXY_DEPTH trusted in front"
fi
if [ -n "$TS_SITE" ] && [ -n "$TS_SECRET" ]; then
  note 'Turnstile   configured'
else
  note 'Turnstile   NOT configured'
fi
note 'Files       .env (mode 600), docker-compose.yml'
printf '\n'

if [ -z "$TS_SITE" ] || [ -z "$TS_SECRET" ]; then
  warn 'Turnstile is not configured: paste creation will fail until you fill it in .env.'
fi

case "$PUBLIC_URL" in
  https://*) ;;
  *) warn "BETTER_AUTH_URL is not https ($PUBLIC_URL) — fine locally, wrong in production." ;;
esac

# ------------------------------------------------------------------ start

START="${SHHH_START:-$(ask 'Start it now? (y/n)' 'y')}"
if yes_no "$START"; then
  printf '\n'
  say 'docker compose up -d'
  docker compose up -d
  printf '\n'
  say "Open $PUBLIC_URL — the setup wizard creates the first admin account."
  note 'Logs: docker compose logs -f app'
else
  printf '\n'
  say 'Review .env, then: docker compose up -d'
fi
