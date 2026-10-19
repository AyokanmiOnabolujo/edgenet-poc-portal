import { INestApplication, ValidationPipe } from '@nestjs/common';

/** App-wide HTTP setup, shared by main.ts and the e2e tests so tests run the same pipeline as production. */
export function setup(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  return app;
}
