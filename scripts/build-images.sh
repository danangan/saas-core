#!/usr/bin/env bash
# Builds the container images: backend (API and worker) and ui.
#
#   scripts/build-images.sh                  build saas-core-backend:<tag> and saas-core-ui:<tag>
#   scripts/build-images.sh --push           build, then push
#
#   IMAGE_TAG       default: the current git commit, or "dev"
#   IMAGE_REGISTRY  prefix, e.g. ghcr.io/acme (default: none)
#   PLATFORM        e.g. linux/amd64 (default: the host's)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if command -v docker >/dev/null 2>&1; then RUNTIME=docker
elif command -v podman >/dev/null 2>&1; then RUNTIME=podman
else echo "Docker or Podman is needed." >&2; exit 1; fi

TAG="${IMAGE_TAG:-$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo dev)}"
PREFIX="${IMAGE_REGISTRY:+${IMAGE_REGISTRY%/}/}"
PLATFORM_ARGS=()
[[ -n "${PLATFORM:-}" ]] && PLATFORM_ARGS=(--platform "$PLATFORM")

for app in backend ui; do
  image="${PREFIX}saas-core-${app}:${TAG}"
  echo "[images] building $image"
  "$RUNTIME" build ${PLATFORM_ARGS[@]+"${PLATFORM_ARGS[@]}"} -f "$ROOT/$app/Dockerfile" -t "$image" -t "${PREFIX}saas-core-${app}:latest" "$ROOT"
  if [[ "${1:-}" == "--push" ]]; then
    "$RUNTIME" push "$image"
    "$RUNTIME" push "${PREFIX}saas-core-${app}:latest"
  fi
done
