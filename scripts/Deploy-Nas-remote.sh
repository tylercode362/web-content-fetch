#!/bin/sh
set -eu

archive="$1"
archive_hash="$2"
remote_root="$3"
project="$4"
compose_project="$5"
docker_bin="$6"
compose_bin="$7"
compose_plugin="$8"
run_id="$9"
incoming_config="${10}"
health_timeout="${11}"
keep_staging="${12}"
nas_host="${13}"

case "$remote_root" in
  /volume1/docker) ;;
  *) echo "invalid remote root" >&2; exit 2 ;;
esac
case "$project" in
  web-content-fetch) ;;
  *) echo "invalid project name" >&2; exit 2 ;;
esac
case "$run_id" in
  [A-Za-z0-9._-]*) ;;
  *) echo "invalid run id" >&2; exit 2 ;;
esac
case "$nas_host" in
  ''|*[!A-Za-z0-9._-]*) echo "invalid NAS host" >&2; exit 2 ;;
esac
case "$incoming_config" in
  none|/volume1/docker/.staging/*/.env) ;;
  *) echo "invalid incoming configuration path" >&2; exit 2 ;;
esac

remote_project="$remote_root/$project"
run_root="$remote_root/.staging/$project-$run_id"
stage_root="$run_root/source"
backup_root="$remote_root/.backups/$project-$run_id"
compose_file="$stage_root/compose.yaml"
nas_compose_file="$stage_root/compose.nas.yaml"

fail() {
  echo "WCF NAS remote deployment failed: $*" >&2
  exit 1
}

if [ ! -x "$docker_bin" ]; then
  docker_bin="$(command -v docker || true)"
fi
if [ ! -x "$docker_bin" ] && [ -x /usr/local/bin/docker ]; then
  docker_bin=/usr/local/bin/docker
fi
[ -x "$docker_bin" ] || fail "Docker executable not found"
if [ "$compose_plugin" = "1" ]; then
  compose() {
    "$docker_bin" compose -p "$compose_project" -f "$compose_file" -f "$nas_compose_file" "$@"
  }
else
  if [ ! -x "$compose_bin" ]; then
    compose_bin="$(command -v docker-compose || true)"
  fi
  if [ ! -x "$compose_bin" ] && [ -x /usr/local/bin/docker-compose ]; then
    compose_bin=/usr/local/bin/docker-compose
  fi
  [ -x "$compose_bin" ] || fail "Docker Compose executable not found"
  compose() {
    "$compose_bin" -p "$compose_project" -f "$compose_file" -f "$nas_compose_file" "$@"
  }
fi
echo "Using Docker: $docker_bin"
if [ "$compose_plugin" = "1" ]; then
  echo "Using Docker Compose plugin: $docker_bin compose"
else
  echo "Using Docker Compose: $compose_bin"
fi

[ -f "$archive" ] || fail "deployment archive is missing"
[ "$(sha256sum "$archive" | awk '{print $1}')" = "$archive_hash" ] || fail "deployment archive checksum mismatch"

set_env_value() {
  env_name="$1"
  env_value="$2"
  env_file="$3"
  if grep -q "^${env_name}=" "$env_file"; then
    sed -i "s|^${env_name}=.*|${env_name}=${env_value}|" "$env_file"
  else
    printf '%s=%s\n' "$env_name" "$env_value" >> "$env_file"
  fi
}

mkdir -p "$stage_root" "$backup_root"
tar -xf "$archive" -C "$stage_root"
if [ -f "$remote_project/.env" ]; then
  [ ! -L "$remote_project/.env" ] || fail "NAS .env must not be a symlink"
  cp -p "$remote_project/.env" "$stage_root/.env"
elif [ "$incoming_config" != "none" ]; then
  [ -f "$incoming_config" ] || fail "incoming NAS .env is missing"
  [ ! -L "$incoming_config" ] || fail "incoming NAS .env must not be a symlink"
  cp -p "$incoming_config" "$stage_root/.env"
else
  fail "first deployment requires -InitializeRemoteConfig or an existing NAS .env"
fi
chmod 600 "$stage_root/.env"
if [ -f "$remote_project/compose.nas.yaml" ]; then
  cp -p "$remote_project/compose.nas.yaml" "$stage_root/compose.nas.yaml"
else
  [ -f "$stage_root/compose.nas.example.yaml" ] || fail "tracked compose.nas.example.yaml is missing"
  cp -p "$stage_root/compose.nas.example.yaml" "$stage_root/compose.nas.yaml"
fi
set_env_value WEB_CONTENT_FETCH_CALLBACK_URL 'http://web-content-fetch:8092/api/bridge/callback' "$stage_root/.env"
set_env_value WEB_CONTENT_FETCH_CALLBACK_ALLOWED_HOSTS 'host.docker.internal,web-content-fetch' "$stage_root/.env"
set_env_value WEB_CONTENT_FETCH_CALLBACK_PROXY_ORIGINS "http://${nas_host}:8088" "$stage_root/.env"
chmod 600 "$stage_root/.env"

for required in compose.yaml compose.nas.yaml Dockerfile server.js; do
  [ -f "$stage_root/$required" ] || fail "staged source is missing $required"
done

if ! "$docker_bin" network inspect local-gateway-chrome-bridge >/dev/null 2>&1; then
  fail "local-gateway-chrome-bridge is missing; deploy Local Gateway and Chrome Bridge first"
fi
if ! "$docker_bin" network inspect local-gateway-web-content-fetch >/dev/null 2>&1; then
  "$docker_bin" network create local-gateway-web-content-fetch >/dev/null
fi

if [ -f "$remote_project/compose.yaml" ]; then
  tar -cf "$backup_root/runtime-source.tar" -C "$remote_project" \
    --exclude=.env --exclude=exports --exclude='*.epub' --exclude='*.zip' .
  cp -p "$remote_project/.env" "$backup_root/.env"
  [ ! -f "$remote_project/compose.nas.yaml" ] || cp -p "$remote_project/compose.nas.yaml" "$backup_root/compose.nas.yaml"
fi

compose config --quiet
compose build web-content-fetch

rollback_needed=0
rollback() {
  if [ "$rollback_needed" -ne 1 ]; then return 0; fi
  echo "Deployment failed; attempting rollback from $backup_root." >&2
  set +e
  if [ -f "$backup_root/runtime-source.tar" ]; then
    tar -xf "$backup_root/runtime-source.tar" -C "$remote_project"
    cp -p "$backup_root/.env" "$remote_project/.env"
    [ ! -f "$backup_root/compose.nas.yaml" ] || cp -p "$backup_root/compose.nas.yaml" "$remote_project/compose.nas.yaml"
    compose up -d --build --force-recreate web-content-fetch
  fi
  set -e
}
on_exit() {
  status=$?
  if [ "$status" -ne 0 ]; then
    rollback
    echo "Deployment did not complete. Staging retained at $run_root." >&2
  fi
  exit "$status"
}
trap on_exit EXIT

rollback_needed=1
mkdir -p "$remote_project"
tar -xf "$archive" -C "$remote_project"
cp -p "$stage_root/compose.nas.yaml" "$remote_project/compose.nas.yaml"
cp -p "$stage_root/.env" "$remote_project/.env"

echo "Recreating web-content-fetch."
compose up -d --build --force-recreate web-content-fetch

http_ok() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS --connect-timeout 3 --max-time 8 "$1" >/dev/null 2>&1
  else
    wget -q -T 8 -O /dev/null "$1" >/dev/null 2>&1
  fi
}
wait_http() {
  label="$1"
  url="$2"
  deadline=$(( $(date +%s) + health_timeout ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if http_ok "$url"; then
      echo "healthy: $label"
      return 0
    fi
    sleep 2
  done
  echo "health timeout: $label" >&2
  return 1
}

wait_http web-content-fetch "http://127.0.0.1:8092/healthz"
wait_http local-gateway-web-content-fetch "http://127.0.0.1:8088/web-content-fetch/healthz"
compose ps web-content-fetch

rollback_needed=0
if [ "$keep_staging" = "0" ]; then
  rm -rf "$run_root"
else
  echo "Staging retained at $run_root."
fi
echo "WCF deployment completed. Backup retained at $backup_root."
