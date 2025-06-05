import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1749143094976 implements MigrationInterface {
    name = 'Initial1749143094976'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'scheduler', 'viewer')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'viewer', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "clerkId" character varying NOT NULL, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_b0e4d1eb939d0387788678c4f8e" UNIQUE ("clerkId"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "work_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "woId" character varying NOT NULL, "numberOfAssemblies" integer NOT NULL, "assemblyCycleTime" double precision NOT NULL, "numberOfParts" integer NOT NULL, "numberOfPlacements" integer NOT NULL, "isDoubleSided" boolean NOT NULL DEFAULT false, "materialAvailableDate" TIMESTAMP NOT NULL, "clearToBuild" boolean NOT NULL DEFAULT false, "dueDate" TIMESTAMP NOT NULL, "startDate" TIMESTAMP, "setupTime" double precision NOT NULL, "tearDownTime" double precision NOT NULL, "totalJobTime" double precision NOT NULL, "lineId" uuid, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isCompleted" boolean NOT NULL DEFAULT false, "completedAt" TIMESTAMP, CONSTRAINT "UQ_ebdc256b6d7455a467a275f461d" UNIQUE ("woId"), CONSTRAINT "PK_29f6c1884082ee6f535aed93660" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."lines_status_enum" AS ENUM('active', 'down', 'maintenance')`);
        await queryRunner.query(`CREATE TABLE "lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "status" "public"."lines_status_enum" NOT NULL DEFAULT 'active', "feederCapacity" integer NOT NULL, "description" text, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "lastMaintenanceDate" TIMESTAMP, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_e00c638fdac01816ea68e225bb5" UNIQUE ("name"), CONSTRAINT "PK_155ad34738bc0e1aab0ca198dea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "work_orders" ADD CONSTRAINT "FK_cb99fbbcb411ee6a42653568934" FOREIGN KEY ("lineId") REFERENCES "lines"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "work_orders" DROP CONSTRAINT "FK_cb99fbbcb411ee6a42653568934"`);
        await queryRunner.query(`DROP TABLE "lines"`);
        await queryRunner.query(`DROP TYPE "public"."lines_status_enum"`);
        await queryRunner.query(`DROP TABLE "work_orders"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
