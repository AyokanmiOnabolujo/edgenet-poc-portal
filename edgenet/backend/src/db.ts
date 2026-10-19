import { defaults, types } from 'pg';
import { DataSourceOptions } from 'typeorm';
import { Activity, PocRequest, User } from './entities';

// createdAt/updatedAt are "timestamp without time zone" columns holding UTC (the database's now()). By default the pg
// driver reads and writes them in the server's local time zone, which shifts every time on a machine not set to UTC.
// ponytail: treats stored timestamps as UTC; move the columns to timestamptz in a migration if that ever stops being true.
types.setTypeParser(types.builtins.TIMESTAMP, (v: string) => new Date(v.replace(' ', 'T') + 'Z'));
defaults.parseInputDatesAsUTC = true;

/**
 * Database settings shared by the app and the TypeORM CLI (data-source.ts).
 * Schema changes go through the migrations in src/migrations, which run in a transaction when the app starts.
 * synchronize stays off: it alters the live schema without review and can drop columns.
 */
export const dbOptions = (url: string): DataSourceOptions => ({
  type: 'postgres',
  url,
  entities: [User, PocRequest, Activity],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsRun: true,
  migrationsTransactionMode: 'each',
  synchronize: false,
});
