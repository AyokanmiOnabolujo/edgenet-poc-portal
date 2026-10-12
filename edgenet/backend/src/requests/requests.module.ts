import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity, PocRequest, User } from '../entities';
import { UsersModule } from '../users/users.module';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [TypeOrmModule.forFeature([PocRequest, Activity, User]), UsersModule],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
