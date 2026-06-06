The default branch is main. Always target main for branches and pull requests.

## Railway

Railway start command is configured via `railway.json`. The `--accept-data-loss` flag is required
because we use `prisma db push` rather than proper migrations. This is acceptable while there's no
real customer data; before launching to real users, migrate to `prisma migrate deploy` workflow.

## Apple Pay

Apple Pay via Stripe requires a domain verification file at
`/.well-known/apple-developer-merchantid-domain-association`. After deploy, register the domain
in Stripe dashboard, get the file content, and place it in `public/.well-known/`.
