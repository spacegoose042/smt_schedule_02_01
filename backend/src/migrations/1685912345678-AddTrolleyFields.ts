import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTrolleyFields1685912345678 implements MigrationInterface {
    name = 'AddTrolleyFields1685912345678'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add trolleysRequired to work_orders table if it doesn't exist
        const workOrdersTable = await queryRunner.query(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_name = 'work_orders' AND column_name = 'trolleysRequired'`
        );
        
        if (workOrdersTable.length === 0) {
            // First add the column allowing nulls
            await queryRunner.query(`
                ALTER TABLE "work_orders" 
                ADD COLUMN "trolleysRequired" integer
            `);

            // Set default value for existing records
            await queryRunner.query(`
                UPDATE "work_orders"
                SET "trolleysRequired" = 1
                WHERE "trolleysRequired" IS NULL
            `);

            // Now make it not null with a default
            await queryRunner.query(`
                ALTER TABLE "work_orders"
                ALTER COLUMN "trolleysRequired" SET NOT NULL,
                ALTER COLUMN "trolleysRequired" SET DEFAULT 1
            `);
        }

        // Add trolleySpaces to material_list in work_orders
        await queryRunner.query(`
            UPDATE "work_orders"
            SET "materialList" = (
                SELECT jsonb_agg(
                    CASE 
                        WHEN jsonb_typeof(elem->'trolleySpaces') = 'null' 
                        THEN jsonb_set(elem, '{trolleySpaces}', '1'::jsonb)
                        ELSE elem
                    END
                )
                FROM jsonb_array_elements(COALESCE("materialList", '[]'::jsonb)) elem
            )
            WHERE jsonb_array_length("materialList") > 0
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove trolleySpaces from material_list in work_orders
        await queryRunner.query(`
            UPDATE "work_orders"
            SET "materialList" = (
                SELECT jsonb_agg(elem - 'trolleySpaces')
                FROM jsonb_array_elements(COALESCE("materialList", '[]'::jsonb)) elem
            )
            WHERE jsonb_array_length("materialList") > 0
        `);

        // Remove trolleysRequired from work_orders table if it exists
        const workOrdersTable = await queryRunner.query(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_name = 'work_orders' AND column_name = 'trolleysRequired'`
        );
        
        if (workOrdersTable.length > 0) {
            await queryRunner.query(`
                ALTER TABLE "work_orders" 
                DROP COLUMN "trolleysRequired"
            `);
        }
    }
} 