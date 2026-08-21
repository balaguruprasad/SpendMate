-- Accounts review sign-off on completed charges
ALTER TABLE "transactions" ADD COLUMN "reviewedAt" TIMESTAMPTZ(3);
ALTER TABLE "transactions" ADD COLUMN "reviewedBy" UUID;
