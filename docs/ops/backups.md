# Backups and the restore drill

B7.10 (RENA-070). The production database is the Railway Postgres service
`Postgres-lIPQ` in the production environment of the Railway project the web
service runs in (region europe-west4). Every fact below that only Railway's
dashboard or James can state is marked "James to enter"; nothing is asserted
that the repository cannot prove.

## What is backed up

| Item                   | Value                                                                                          | Source                    |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ------------------------- |
| Backup kind            | PITR plus daily snapshots (as recorded on 2026-09-03)                                          | docs/campaign-handover.md |
| Retention of snapshots | James to enter, as Railway states it on the day read                                           | Railway dashboard         |
| PITR window            | James to enter                                                                                 | Railway dashboard         |
| Document objects (R2)  | not covered by the database backup; the bucket's own versioning or lifecycle is James to enter | Cloudflare dashboard      |

## Restore procedure (non production copy only)

1. In Railway, fork or restore the Postgres service to a NEW service in a
   non production environment (never in place).
2. Point a non production web deployment (staging, or a rig) at the new
   database with its own `DATABASE_URL`; never the production service.
3. Verify: `prisma migrate status` reports no pending migrations; row counts
   for `User`, `Booking`, `Message`, `AuditLog` and `DataRetentionLog` are
   recorded; the latest `SchedulerLease.lastSucceededAt` and the newest
   `Booking.createdAt` are within the expected window of the restore point.
4. Record the drill below and delete the restored copy afterwards.

## Drill record

| Date           | Operator | Restore point | Target | Row counts (User, Booking, Message, AuditLog, DataRetentionLog) | Newest Booking.createdAt | Result |
| -------------- | -------- | ------------- | ------ | --------------------------------------------------------------- | ------------------------ | ------ |
| James to enter |          |               |        |                                                                 |                          |        |

Nothing in a session touches the production database; the drill is James's.
