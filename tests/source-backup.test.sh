#!/usr/bin/env bash
# Local-only Git fixtures: no network, real credentials, database or production paths.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git init -q --bare "$tmp/origin.git"
git init -q -b main "$tmp/work"
cd "$tmp/work"
git config user.name 'Synthetic source backup QA'
git config user.email 'source-backup@example.test'
mkdir -p deploy .githooks
cp "$root/deploy/push-source-backup.sh" deploy/
cp "$root/.githooks/post-commit" .githooks/
echo 'Synthetic source only' > source.txt
git add . && git commit -qm 'Synthetic baseline'
git remote add origin "$tmp/origin.git"
./deploy/push-source-backup.sh
[[ "$(git rev-parse HEAD)" == "$(git --git-dir="$tmp/origin.git" rev-parse refs/heads/backup/earning-hub)" ]]
! git --git-dir="$tmp/origin.git" show-ref --verify --quiet refs/heads/main
echo 'PASS: dedicated branch pushes source without touching main'
if SOURCE_BACKUP_BRANCH=main ./deploy/push-source-backup.sh; then exit 1; fi
echo 'PASS: default branch cannot be overwritten'
echo 'Synthetic uncommitted draft' > draft.txt
if ./deploy/push-source-backup.sh; then exit 1; fi
rm draft.txt
echo 'PASS: dirty source is not claimed as backed up'
git config --local core.hooksPath .githooks
echo 'Synthetic update' >> source.txt
git add source.txt && git commit -qm 'Synthetic hooked update'
[[ "$(git rev-parse HEAD)" == "$(git --git-dir="$tmp/origin.git" rev-parse refs/heads/backup/earning-hub)" ]]
echo 'PASS: post-commit hook backs up later commits'
git remote set-url origin "$tmp/nonexistent.git"
echo 'Synthetic offline update' >> source.txt
git add source.txt && git commit -qm 'Synthetic offline local commit retained'
git log -1 --format=%s | grep -Fx 'Synthetic offline local commit retained'
echo 'PASS: failed remote backup preserves local commit'
git config --unset core.hooksPath
echo 'SYNTHETIC_NOT_A_SECRET=true' > .env
git add .env && git commit -qm 'Synthetic filename rejection fixture'
git remote set-url origin "$tmp/origin.git"
if ./deploy/push-source-backup.sh; then exit 1; fi
echo 'PASS: sensitive filename in reachable history blocks push'
