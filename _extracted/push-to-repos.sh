#!/bin/bash
# Push extracted mobile apps to their own GitHub repos.
# Run this script from the _extracted/ directory.
#
# Usage:
#   cd _extracted
#   chmod +x push-to-repos.sh
#   ./push-to-repos.sh

set -e

echo "=== Pushing Rena Customer App to ezyjtw/Rena-Cleaning-app ==="
cd Rena-Cleaning-app
git init -b main
git add -A
git commit -m "Initial commit: Rena Customer App (standalone)

Extracted from monorepo with inlined shared package.
Includes types, enums, constants, validation, and API client."
git remote add origin https://github.com/ezyjtw/Rena-Cleaning-app.git
git push -u origin main
cd ..

echo ""
echo "=== Pushing Rena Cleaner App to ezyjtw/Rena-Cleaner-app ==="
cd Rena-Cleaner-app
git init -b main
git add -A
git commit -m "Initial commit: Rena Cleaner App (standalone)

Extracted from monorepo with inlined shared package.
Includes types, enums, constants, validation, and API client."
git remote add origin https://github.com/ezyjtw/Rena-Cleaner-app.git
git push -u origin main
cd ..

echo ""
echo "Done! Both apps have been pushed to their repos."
echo "You can now safely delete the _extracted/ directory."
