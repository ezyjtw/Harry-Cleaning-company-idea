#!/bin/bash
# Preview publish of ONE shell piece (James's batch run item 4), with its
# evidence. Usage: publish-piece.sh <piece-name> <commit> <mobile|mobile-customer>
# The only change to the commit's tree is extra.baseUrl -> staging (named).
set -u
PIECE=$1; C=$2; APP=$3
S=/tmp/claude-0/-home-user-Harry-Cleaning-company-idea/a758c5d5-1a1f-53a7-a7f7-5c9231232b70/scratchpad
R=/home/user/Harry-Cleaning-company-idea
W=$S/pub-$PIECE
OUT=$S/packs/$PIECE.txt
mkdir -p $S/packs
cd $R && git worktree remove --force $W 2>/dev/null; git worktree add -q -f --detach $W $C || exit 2
ln -sfn $R/node_modules $W/node_modules
ln -sfn $R/mobile/node_modules $W/mobile/node_modules
ln -sfn $R/mobile-customer/node_modules $W/mobile-customer/node_modules
{
  echo "PIECE $PIECE  app=$APP  commit=$(cd $W && git rev-parse --short HEAD)  $(cd $W && git log -1 --format=%s | cut -c1-100)"
  echo "tracked source dirty before config edit: $(cd $W && git status --short --untracked-files=no | wc -l)"
  echo "version/runtime: $(python3 -c "import json;e=json.load(open('$W/$APP/app.json'))['expo'];print(e['version'], e.get('runtimeVersion'))")"
  if [ -f $W/src/lib/ci/shell-nav.test.ts ]; then
    echo "shell-nav tests: $(cd $W && npx vitest run src/lib/ci/shell-nav.test.ts 2>&1 | grep -E 'Tests ' | tr -s ' ')"
  else
    echo "shell-nav tests: (file not present at this commit)"
  fi
  echo "typecheck $APP: $(cd $W/$APP && npx tsc --noEmit >/dev/null 2>&1; echo rc=$?)"
  cp $S/cooked-proof.ts $R/cooked-proof.ts
  echo "STRING-LAW cooked-parse:"; (cd $R && npx tsx cooked-proof.ts $W/$APP/App.tsx 2>&1 | sed "s#$W/##; s/^/  /")
  rm -f $R/cooked-proof.ts
  python3 - "$W/$APP/app.json" <<'EOF'
import sys
p=sys.argv[1]; s=open(p).read()
a='"baseUrl": "https://www.renacleaning.co.uk"'
assert s.count(a)==1
open(p,'w').write(s.replace(a,'"baseUrl": "https://rena-web-staging-staging.up.railway.app"'))
EOF
  echo "config difference from $C: $(cd $W && git diff --stat | tail -1) ($(cd $W && git diff -U0 $APP/app.json | grep '^[+-] ' | tr -s ' ' | tr '\n' ' '))"
  echo "EAS publish (branch preview-$PIECE):"
  (cd $W/$APP && EXPO_TOKEN=proxy-injected timeout 900 npx -y eas-cli@16 update --branch preview-$PIECE \
     --message "PREVIEW $PIECE from $C, staging (preview only, James's batch run 23 Oct)" --non-interactive 2>&1 \
     | grep -E 'Branch|Runtime version|Platform|Update group ID|Commit|rror' | sed 's/^/  /')
} > $OUT 2>&1
cd $R && git worktree remove --force $W
cat $OUT
