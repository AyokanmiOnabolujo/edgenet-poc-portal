import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setup } from './setup';

async function bootstrap() {
  const app = setup(await NestFactory.create(AppModule));
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
