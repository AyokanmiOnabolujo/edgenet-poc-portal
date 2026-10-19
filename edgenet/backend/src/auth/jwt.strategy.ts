import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../entities';
import { jwtSecret } from './jwt-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, @InjectRepository(User) private users: Repository<User>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtSecret(config.get('JWT_SECRET')),
    });
  }
  async validate(payload: { sub: string }) {
    // Unapproved accounts never get a token, but check anyway so a token can never outlive the approval rule.
    const user = await this.users.findOneBy({ id: payload.sub, approved: true });
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
