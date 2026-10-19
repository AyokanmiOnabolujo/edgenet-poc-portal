// Tests only ever touch a local throwaway database, never the deployed one.
const url = process.env.TEST_DATABASE_URL ?? 'postgres://edgenet:edgenet@localhost:55433/edgenet_test';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error('Tests refuse to run against a non-local database.');
process.env.DATABASE_URL = url;
process.env.JWT_SECRET = 'test-secret';
