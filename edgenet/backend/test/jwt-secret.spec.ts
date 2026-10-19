import { jwtSecret } from '../src/auth/jwt-secret';

describe('jwtSecret', () => {
  it('requires a value, and a real one in production', () => {
    expect(() => jwtSecret(undefined, 'development')).toThrow(/JWT_SECRET is not set/);
    expect(() => jwtSecret('', 'production')).toThrow(/not set/);
    expect(() => jwtSecret('dev-secret', 'production')).toThrow(/placeholder/);
    expect(() => jwtSecret('change-me', 'production')).toThrow(/placeholder/);
    expect(jwtSecret('change-me', 'development')).toBe('change-me');
    expect(jwtSecret('k3y-from-the-host-settings-9f8e7d6c', 'production')).toBe('k3y-from-the-host-settings-9f8e7d6c');
  });
});
