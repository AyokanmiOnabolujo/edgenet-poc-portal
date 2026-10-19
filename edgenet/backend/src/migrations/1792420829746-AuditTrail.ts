import { MigrationInterface, QueryRunner } from "typeorm";

export class AuditTrail1792420829746 implements MigrationInterface {
    name = 'AuditTrail1792420829746'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "activity" ADD "action" character varying`);
        await queryRunner.query(`ALTER TABLE "activity" ADD "fromValue" character varying`);
        await queryRunner.query(`ALTER TABLE "activity" ADD "toValue" character varying`);
        await queryRunner.query(`ALTER TABLE "activity" ADD "remarks" text`);
        await queryRunner.query(`ALTER TABLE "activity" ALTER COLUMN "createdAt" SET DEFAULT clock_timestamp()`);
        await queryRunner.query(`CREATE INDEX "IDX_68a3e51512e72c60950d614479" ON "activity" ("requestId", "createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_68a3e51512e72c60950d614479"`);
        await queryRunner.query(`ALTER TABLE "activity" ALTER COLUMN "createdAt" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "activity" DROP COLUMN "remarks"`);
        await queryRunner.query(`ALTER TABLE "activity" DROP COLUMN "toValue"`);
        await queryRunner.query(`ALTER TABLE "activity" DROP COLUMN "fromValue"`);
        await queryRunner.query(`ALTER TABLE "activity" DROP COLUMN "action"`);
    }

}
