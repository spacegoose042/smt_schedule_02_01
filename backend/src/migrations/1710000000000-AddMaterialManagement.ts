import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMaterialManagement1710000000000 implements MigrationInterface {
    name = 'AddMaterialManagement1710000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if enum type exists
        const enumExists = await queryRunner.query(`
            SELECT 1 FROM pg_type 
            WHERE typname = 'work_order_material_status_enum'
        `);

        if (enumExists.length === 0) {
            await queryRunner.query(`
                CREATE TYPE "public"."work_order_material_status_enum" AS ENUM (
                    'pending',
                    'partial',
                    'complete',
                    'missing'
                )
            `);
        }

        // Check which columns need to be added
        const columns = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'work_orders' 
            AND column_name IN ('material_status', 'material_list', 'notes')
        `);

        const existingColumns = new Set(columns.map((col: any) => col.column_name));

        const columnsToAdd = [];
        if (!existingColumns.has('material_status')) {
            columnsToAdd.push(`ADD COLUMN "material_status" "public"."work_order_material_status_enum" NOT NULL DEFAULT 'pending'`);
        }
        if (!existingColumns.has('material_list')) {
            columnsToAdd.push(`ADD COLUMN "material_list" jsonb`);
        }
        if (!existingColumns.has('notes')) {
            columnsToAdd.push(`ADD COLUMN "notes" text`);
        }

        if (columnsToAdd.length > 0) {
            await queryRunner.query(`
                ALTER TABLE "work_orders"
                ${columnsToAdd.join(',\n')}
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Check which columns exist before trying to drop them
        const columns = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'work_orders' 
            AND column_name IN ('material_status', 'material_list', 'notes')
        `);

        const existingColumns = new Set(columns.map((col: any) => col.column_name));

        const columnsToDrop = [];
        if (existingColumns.has('material_status')) {
            columnsToDrop.push(`DROP COLUMN "material_status"`);
        }
        if (existingColumns.has('material_list')) {
            columnsToDrop.push(`DROP COLUMN "material_list"`);
        }
        if (existingColumns.has('notes')) {
            columnsToDrop.push(`DROP COLUMN "notes"`);
        }

        if (columnsToDrop.length > 0) {
            await queryRunner.query(`
                ALTER TABLE "work_orders"
                ${columnsToDrop.join(',\n')}
            `);
        }

        // Check if enum type exists before dropping
        const enumExists = await queryRunner.query(`
            SELECT 1 FROM pg_type 
            WHERE typname = 'work_order_material_status_enum'
        `);

        if (enumExists.length > 0) {
            await queryRunner.query(`DROP TYPE "public"."work_order_material_status_enum"`);
        }
    }
} 