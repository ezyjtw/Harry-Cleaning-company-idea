-- F26: cleaner profile visibility switch. Default true so every existing
-- cleaner stays discoverable; hiding is an explicit act through either door.
ALTER TABLE "CleanerProfile" ADD COLUMN "visibleInDirectory" BOOLEAN NOT NULL DEFAULT true;
