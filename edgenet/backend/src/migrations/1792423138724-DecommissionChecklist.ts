import { MigrationInterface, QueryRunner } from "typeorm";

export class DecommissionChecklist1792423138724 implements MigrationInterface {
    name = 'DecommissionChecklist1792423138724'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "decommission_checks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying NOT NULL, "completedAt" TIMESTAMP NOT NULL DEFAULT clock_timestamp(), "notes" text, "requestId" uuid NOT NULL, "completedById" uuid NOT NULL, CONSTRAINT "UQ_64318b6c4b51805066ef9dd80ad" UNIQUE ("requestId", "key"), CONSTRAINT "PK_cce09f33b56c95ec89b15d823f3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "decommission_checks" ADD CONSTRAINT "FK_784221f9b1d343c5f14ca0045e0" FOREIGN KEY ("requestId") REFERENCES "poc_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "decommission_checks" ADD CONSTRAINT "FK_4d7c2de9e0e1609219bb6cf260f" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "decommission_checks" DROP CONSTRAINT "FK_4d7c2de9e0e1609219bb6cf260f"`);
        await queryRunner.query(`ALTER TABLE "decommission_checks" DROP CONSTRAINT "FK_784221f9b1d343c5f14ca0045e0"`);
        await queryRunner.query(`DROP TABLE "decommission_checks"`);
    }

}
