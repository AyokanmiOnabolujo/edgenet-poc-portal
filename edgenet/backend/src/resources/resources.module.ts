import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Allocation, InventoryResource, PocRequest } from '../entities';
import { AllocationsController, ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryResource, Allocation, PocRequest])],
  controllers: [ResourcesController, AllocationsController],
  providers: [ResourcesService],
})
export class ResourcesModule {}
