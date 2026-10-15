# Historical prototype — do not deploy

Original UI, browser-local accounts, fake pairing/delivery/payout flows and seeded records are retained here for source reference and rollback. These files are excluded from TypeScript, the frontend build and the Docker image. They do not represent current capabilities. Any credentials in this historical prototype were public demo values, not valid accounts in the new server.

The old Prisma schema is also retained at ../prisma/schema.prisma for future design reference; it is not connected to the new runtime. Do not run migrations from it against a live database without a migration plan.
