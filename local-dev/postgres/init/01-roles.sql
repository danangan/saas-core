-- Local development only: the login role the app connects as, with a fixed dev password.
-- Table-level grants are applied by the Prisma migrations in prisma/migrations.
CREATE ROLE saas_app LOGIN PASSWORD 'saas_app';
