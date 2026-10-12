import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { RequestsModule } from './requests/requests.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        type: 'postgres' as const,
        url: c.get('DATABASE_URL'),
        autoLoadEntities: true,
        // Creates/updates tables automatically. Switch to migrations before production.
        synchronize: true,
      }),
    }),
    AuthModule,
    UsersModule,
    RequestsModule,
  ],
})
export class AppModule {}
