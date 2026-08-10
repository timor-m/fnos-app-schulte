#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGE_DIR="${ROOT_DIR}/.fnos-build/package"
DIST_DIR="${ROOT_DIR}/dist"
APP_NAME="$(node -p 'require(process.argv[1]).name' "${ROOT_DIR}/package.json")"
APP_VERSION="$(node -p 'require(process.argv[1]).version' "${ROOT_DIR}/package.json")"
SOURCE_FPK="${ROOT_DIR}/${APP_NAME}.fpk"
OUTPUT_FPK="${DIST_DIR}/${APP_NAME}-${APP_VERSION}.fpk"

FNPACK_BIN="${ROOT_DIR}/tools/fnpack"

if [ ! -x "${FNPACK_BIN}" ]; then
  if command -v fnpack >/dev/null 2>&1; then
    FNPACK_BIN="$(command -v fnpack)"
  else
    echo "fnpack is not installed."
    echo "You can place a local binary at tools/fnpack, then rerun: npm run pack:fpk"
    exit 1
  fi
fi

mkdir -p "${DIST_DIR}"
rm -f "${SOURCE_FPK}" "${DIST_DIR}/${APP_NAME}.fpk" "${DIST_DIR}/${APP_NAME}-"*.fpk
(
  cd "${ROOT_DIR}"
  "${FNPACK_BIN}" build --directory "${PACKAGE_DIR}"
)

if [ ! -f "${SOURCE_FPK}" ]; then
  echo "Expected fnpack output was not generated: ${SOURCE_FPK}"
  exit 1
fi

mv "${SOURCE_FPK}" "${OUTPUT_FPK}"

echo "Generated: ${OUTPUT_FPK}"
