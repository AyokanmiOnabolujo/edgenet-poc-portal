import { MigrationInterface, QueryRunner } from "typeorm";

export class ResourceAllocation1792421613416 implements MigrationInterface {
    name = 'ResourceAllocation1792421613416'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "inventory_resources" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organisation" character varying NOT NULL, "name" character varying NOT NULL, "type" character varying NOT NULL, "unit" character varying NOT NULL DEFAULT 'unit', "specs" text NOT NULL DEFAULT '', "capacity" integer NOT NULL, "state" character varying NOT NULL DEFAULT 'available', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "CHK_97178d4d7b15cadd4881b3f39d" CHECK ("capacity" >= 1), CONSTRAINT "PK_78db2a0365b9204387a4a9c02bb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "allocations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quantity" integer NOT NULL, "startDate" date NOT NULL, "endDate" date NOT NULL, "status" character varying NOT NULL DEFAULT 'active', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "releasedAt" TIMESTAMP, "resourceId" uuid NOT NULL, "requestId" uuid NOT NULL, "allocatedById" uuid NOT NULL, "releasedById" uuid, CONSTRAINT "CHK_868c8ff6c58f1daaac4f8d51be" CHECK ("endDate" >= "startDate"), CONSTRAINT "CHK_10377b126a9eff5462c560d21a" CHECK ("quantity" >= 1), CONSTRAINT "PK_ca63099fc248466264af0fa6f1f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_75566497631b932d794509c5fc" ON "allocations" ("resourceId", "status") `);
        await queryRunner.query(`ALTER TABLE "allocations" ADD CONSTRAINT "FK_f6ad22f50eb2a2d3c0bd41731cc" FOREIGN KEY ("resourceId") REFERENCES "inventory_resources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "allocations" ADD CONSTRAINT "FK_f9fa21ad785c1431fce174a74bf" FOREIGN KEY ("requestId") REFERENCES "poc_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "allocations" ADD CONSTRAINT "FK_03c25382d61788ab243f50ab814" FOREIGN KEY ("allocatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "allocations" ADD CONSTRAINT "FK_9e38bc0d8582d26893c780f0b94" FOREIGN KEY ("releasedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "allocations" DROP CONSTRAINT "FK_9e38bc0d8582d26893c780f0b94"`);
        await queryRunner.query(`ALTER TABLE "allocations" DROP CONSTRAINT "FK_03c25382d61788ab243f50ab814"`);
        await queryRunner.query(`ALTER TABLE "allocations" DROP CONSTRAINT "FK_f9fa21ad785c1431fce174a74bf"`);
        await queryRunner.query(`ALTER TABLE "allocations" DROP CONSTRAINT "FK_f6ad22f50eb2a2d3c0bd41731cc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_75566497631b932d794509c5fc"`);
        await queryRunner.query(`DROP TABLE "allocations"`);
        await queryRunner.query(`DROP TABLE "inventory_resources"`);
    }

}
