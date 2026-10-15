#!/usr/bin/env bash
# Push committed source only, without force-updating the production/default branch.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
if [[ -n "$(git status --porcelain)" ]]; then echo 'Commit all intended source changes before backing up. Data/secrets must remain ignored.' >&2; exit 1; fi
branch="${SOURCE_BACKUP_BRANCH:-$(git config --get pappy.sourceBackupBranch || echo backup/earning-hub)}"
case "$branch" in main|master|HEAD) echo 'Use a dedicated backup branch, not the default branch.' >&2; exit 1;; esac
git check-ref-format "refs/heads/$branch"
# Inspect every reachable commit's filenames, not just today's working tree.
if git rev-list --objects --all | awk '{$1="";sub(/^ /,"");print}' | grep -E '(^|/)(\.env($|\.)|data/|\.ssh/)|\.(sqlite([.-].*)?|db|pem|key)$' | grep -v -E '(^|/)\.env\.example$' >/dev/null; then echo 'Sensitive paths found in Git history. Stop and review before any push.' >&2; exit 1; fi
# Fail closed on high-confidence token/private-key patterns without printing values.
scan=0
git grep --quiet -I -E '(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN (OPENSSH|RSA|EC) PRIVATE KEY-----|WA_(ENCRYPTION|IDENTITY)_KEY=[a-fA-F0-9]{64})' $(git rev-list --all) -- || scan=$?
case "$scan" in 0) echo 'Potential credential found in reachable history. Stop and review before any push.' >&2;exit 1;; 1) :;; *) echo 'Credential scan failed; backup blocked.' >&2;exit 1;; esac
remote="${SOURCE_BACKUP_REMOTE:-origin}"
key="${GITHUB_DEPLOY_KEY:-$(git config --get pappy.githubDeployKey || true)}"
if [[ -n "$key" ]]; then
  test -r "$key" || { echo 'GitHub deploy key is not available; local history is retained.' >&2; exit 1; }
  url="$(git remote get-url "$remote")"
  case "$url" in https://github.com/*) remote="git@github.com:${url#https://github.com/}";; git@github.com:*) remote="$url";; *) echo 'Deploy-key mode requires a GitHub remote.' >&2;exit 1;; esac
  known="${GITHUB_KNOWN_HOSTS:-$(git config --get pappy.githubKnownHosts || true)}"
  [[ -n "$known" && -r "$known" ]] || { echo 'Verified GitHub SSH host keys are required.' >&2;exit 1; }
  printf -v GIT_SSH_COMMAND 'ssh -i %q -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=yes -o UserKnownHostsFile=%q' "$key" "$known"
  export GIT_SSH_COMMAND
fi
export GIT_TERMINAL_PROMPT=0
git push --porcelain "$remote" "HEAD:refs/heads/$branch"
echo "Source backup pushed: $(git rev-parse --short HEAD) -> $branch"
