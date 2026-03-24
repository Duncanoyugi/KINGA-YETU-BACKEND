-- Add birth fields to children table
ALTER TABLE "children" ADD COLUMN "birthWeight" DOUBLE PRECISION;
ALTER TABLE "children" ADD COLUMN "birthHeight" DOUBLE PRECISION;
ALTER TABLE "children" ADD COLUMN "deliveryMethod" TEXT;
ALTER TABLE "children" ADD COLUMN "gestationalAge" TEXT;
ALTER TABLE "children" ADD COLUMN "complications" TEXT;
ALTER TABLE "children" ADD COLUMN "notes" TEXT;
