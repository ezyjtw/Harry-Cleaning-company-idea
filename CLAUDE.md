The default branch is main. Always target main for branches and pull requests.

## Railway

Railway start command is configured via `railway.json`. The `--accept-data-loss` flag is required
because we use `prisma db push` rather than proper migrations. This is acceptable while there's no
real customer data; before launching to real users, migrate to `prisma migrate deploy` workflow.
