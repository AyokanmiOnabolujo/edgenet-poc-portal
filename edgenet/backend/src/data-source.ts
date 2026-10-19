import { DataSource } from 'typeorm';
import { dbOptions } from './db';

// Used only by the TypeORM CLI (npm run migration:generate / migration:revert). Reads DATABASE_URL from the environment.
export default new DataSource(dbOptions(process.env.DATABASE_URL));
