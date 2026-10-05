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
chmod 600 "$stage_root/.env"

for required in compose.yaml compose.nas.yaml Dockerfile server.js; do
  [ -f "$stage_root/$required" ] || fail "staged source is missing $required"
done

for network_name in local-gateway-chrome-bridge; do
  if ! "$docker_bin" network inspect "$network_name" >/dev/null 2>&1; then
    fail "$network_name is missing; deploy Local Gateway first"
  fi
  network_internal=$("$docker_bin" network inspect --format '{{.Internal}}' "$network_name")
  if [ "$network_internal" != "true" ]; then
    fail "$network_name exists but is not internal; refusing to replace or disconnect it automatically"
  fi
done

if [ -f "$remote_project/compose.yaml" ]; then
  cp -p "$remote_project/.env" "$backup_root/.env"
  [ ! -f "$remote_project/compose.nas.yaml" ] || cp -p "$remote_project/compose.nas.yaml" "$backup_root/compose.nas.yaml"
fi

compose config --quiet
compose build web-content-fetch

rollback_needed=0
rollback() {
  if [ "$rollback_needed" -ne 1 ]; then return 0; fi
  echo "Deployment failed; restoring configuration from $backup_root. Program source rollback is Git-based." >&2
  set +e
  if [ -f "$backup_root/.env" ]; then
    cp -p "$backup_root/.env" "$remote_project/.env"
    [ ! -f "$backup_root/compose.nas.yaml" ] || cp -p "$backup_root/compose.nas.yaml" "$remote_project/compose.nas.yaml"
    compose_file="$remote_project/compose.yaml"
    nas_compose_file="$remote_project/compose.nas.yaml"
    compose up -d --force-recreate web-content-fetch
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
for source_path in docs openspec scripts test .dockerignore .env.example .gitattributes .gitignore AGENTS.md binding-store.js bridge-client.js callback-url.js compose.nas.example.yaml compose.yaml csrf.js Dockerfile epub-writer.js job-orchestrator.js job-view.js package-lock.json package.json server.js service-endpoints.js ui.css ui.js; do
  rm -rf -- "$remote_project/$source_path"
done
tar -xf "$archive" -C "$remote_project"
cp -p "$stage_root/compose.nas.yaml" "$remote_project/compose.nas.yaml"
cp -p "$stage_root/.env" "$remote_project/.env"

echo "Recreating web-content-fetch."
compose_file="$remote_project/compose.yaml"
nas_compose_file="$remote_project/compose.nas.yaml"
compose up -d --build --force-recreate --remove-orphans web-content-fetch

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

wait_container_healthy() {
  deadline=$(( $(date +%s) + health_timeout ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    container_id=$(compose ps -q web-content-fetch 2>/dev/null || true)
    if [ -n "$container_id" ]; then
      health_status=$("$docker_bin" inspect --format '{{.State.Health.Status}}' "$container_id" 2>/dev/null || true)
      if [ "$health_status" = "healthy" ]; then
        echo "healthy: web-content-fetch container"
        return 0
      fi
    fi
    sleep 2
  done
  echo "health timeout: web-content-fetch container" >&2
  return 1
}

wait_container_healthy
wait_http local-gateway-chrome-bridge "http://127.0.0.1:8088/web-content-fetch/healthz"
compose ps web-content-fetch

rollback_needed=0
for cleanup_root in "$remote_root/.staging" "$remote_root/.backups"; do
  [ -d "$cleanup_root" ] || continue
  find "$cleanup_root" -mindepth 1 -maxdepth 1 -name "$project-*" -exec rm -rf -- {} +
done
"$docker_bin" image prune -f --filter "label=com.docker.compose.project=$compose_project" >/dev/null
echo "WCF deployment completed. Obsolete project staging removed."
