import { MigrationInterface, QueryRunner } from "typeorm";

// The schema as it was when the app still used synchronize: true. Databases created that way (production) already
// have these tables, so this migration only records itself there; on an empty database it creates them.
export class Baseline1792420734174 implements MigrationInterface {
    name = 'Baseline1792420734174'

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasTable('users')) return;
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "role" character varying NOT NULL, "organisation" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "one_account_manager_per_org" ON "users" ("organisation") WHERE "role" = 'account_manager'`);
        await queryRunner.query(`CREATE TABLE "poc_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "number" SERIAL NOT NULL, "organisation" character varying NOT NULL, "clientName" character varying NOT NULL, "clientEmail" character varying NOT NULL, "clientCompany" character varying NOT NULL, "projectName" character varying NOT NULL, "description" text NOT NULL DEFAULT '', "startDate" date NOT NULL, "endDate" date NOT NULL, "priority" character varying NOT NULL DEFAULT 'medium', "status" character varying NOT NULL DEFAULT 'new_request', "resources" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdById" uuid NOT NULL, "assignedEngineerId" uuid, CONSTRAINT "PK_2e87280e3ad80cdb990d105e539" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "activity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "message" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "requestId" uuid, "actorId" uuid, CONSTRAINT "PK_24625a1d6b1b089c8ae206fe467" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "poc_requests" ADD CONSTRAINT "FK_047a1f5e5dda0bdbd8c431efa05" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "poc_requests" ADD CONSTRAINT "FK_6a597f3ad66040249399a969d8e" FOREIGN KEY ("assignedEngineerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "activity" ADD CONSTRAINT "FK_ebf7748dad7570e773519a4b3c9" FOREIGN KEY ("requestId") REFERENCES "poc_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "activity" ADD CONSTRAINT "FK_52ea3a7ddc66851abf6138892bc" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        throw new Error('The baseline migration cannot be reverted: it would drop every table and all data.');
    }

}
