#!/bin/sh
# Installs the War Bash git hooks into .git/hooks (run once after cloning, from the repo root)
cp tools/hooks/pre-push .git/hooks/pre-push && chmod +x .git/hooks/pre-push
# keep any existing pre-commit hook (for example a scrub hook) and add the secret check in front of it
if [ -f .git/hooks/pre-commit ] && ! grep -q check_secrets .git/hooks/pre-commit; then
  sed -i '2i node tools/check_secrets.mjs || exit 1' .git/hooks/pre-commit
elif [ ! -f .git/hooks/pre-commit ]; then
  printf '#!/bin/sh\nexec node tools/check_secrets.mjs\n' > .git/hooks/pre-commit
fi
chmod +x .git/hooks/pre-commit
echo "hooks installed"
