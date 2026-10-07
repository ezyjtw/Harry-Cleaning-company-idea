#!/bin/bash
# R9: built server for hash re-baseline + ceremonial drives (same dummy env
# as the dev rig, next start on the production build).
cd "${WT:?set WT to a worktree of main 8999830 (the control build)}"
export DATABASE_URL="postgresql://rena:rena@127.0.0.1:5432/rena"
export NEXTAUTH_SECRET="dev-secret-for-local-drives-only"
export NEXTAUTH_URL="http://localhost:3000"
export STRIPE_SECRET_KEY="sk_test_dummy"
export STRIPE_PUBLISHABLE_KEY="pk_test_dummy"
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_dummy"
export STRIPE_WEBHOOK_SECRET="whsec_dummy"
export STRIPE_WEBHOOK_SECRET_PLATFORM="whsec_dummy"
export RESEND_API_KEY="re_dummy"
export EMAIL_FROM="dev@localhost"
export RESEND_FROM_EMAIL="Rena <noreply@localhost.test>"
export RESEND_NOTIFICATION_EMAIL="dev@localhost.test"
export R2_ACCOUNT_ID="dummy-account"
export R2_ACCESS_KEY_ID="dummy-key"
export R2_SECRET_ACCESS_KEY="dummy-secret"
export R2_BUCKET_NAME="dummy-bucket"
export DOCUMENT_ENCRYPTION_KEY="dev-only-document-encryption-key-0123456789"
npx next build
