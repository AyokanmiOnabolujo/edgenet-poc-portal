import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DbErrorFilter } from './db-errors';

/** App-wide HTTP setup, shared by main.ts and the e2e tests so tests run the same pipeline as production. */
export function setup(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new DbErrorFilter(app.get(HttpAdapterHost).httpAdapter));
  return app;
}
