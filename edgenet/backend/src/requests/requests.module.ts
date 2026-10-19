import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity, Allocation, DecommissionCheck, PocRequest, User } from '../entities';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [TypeOrmModule.forFeature([PocRequest, Activity, User, Allocation, DecommissionCheck])],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
