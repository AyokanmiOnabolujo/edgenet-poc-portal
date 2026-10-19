import { MigrationInterface, QueryRunner } from "typeorm";

export class EngineerApproval1792426898391 implements MigrationInterface {
    name = 'EngineerApproval1792426898391'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "approved" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "approved"`);
    }

}
