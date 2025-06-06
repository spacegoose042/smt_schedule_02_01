import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMaterialManagement1710000000000 implements MigrationInterface {
    name = 'AddMaterialManagement1710000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add material_status enum type
        await queryRunner.query(`
            CREATE TYPE "public"."work_order_material_status_enum" AS ENUM (
                'pending',
                'partial',
                'complete',
                'missing'
            )
        `);

        // Add new columns to work_orders table
        await queryRunner.query(`
            ALTER TABLE "work_orders"
            ADD COLUMN "material_status" "public"."work_order_material_status_enum" NOT NULL DEFAULT 'pending',
            ADD COLUMN "material_list" jsonb,
            ADD COLUMN "notes" text
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove columns from work_orders table
        await queryRunner.query(`
            ALTER TABLE "work_orders"
            DROP COLUMN "material_status",
            DROP COLUMN "material_list",
            DROP COLUMN "notes"
        `);

        // Drop enum type
        await queryRunner.query(`DROP TYPE "public"."work_order_material_status_enum"`);
    }
} 