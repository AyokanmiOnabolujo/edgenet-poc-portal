import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../entities';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(@InjectRepository(User) private users: Repository<User>, private jwt: JwtService) {}

  private session(u: User) {
    const { passwordHash, ...user } = u;
    return { token: this.jwt.sign({ sub: u.id }), user };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    if (await this.users.findOneBy({ email })) throw new ConflictException('An account with this email already exists.');

    // Match organisation names case-insensitively, reusing the spelling already on file.
    const sameOrg = await this.users
      .createQueryBuilder('u')
      .where('lower(u.organisation) = :o', { o: dto.organisation.trim().toLowerCase() })
      .getOne();
    const organisation = sameOrg?.organisation ?? dto.organisation.trim();

    if (dto.role === 'account_manager' && (await this.users.findOneBy({ organisation, role: 'account_manager' }))) {
      throw new ConflictException('This organisation already has an Account Manager.');
    }
    const user = await this.users.save(
      this.users.create({ name: dto.name.trim(), email, role: dto.role, organisation, passwordHash: await bcrypt.hash(dto.password, 10) }),
    );
    return this.session(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :e', { e: dto.email.toLowerCase().trim() })
      .getOne();
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Incorrect email or password.');
    }
    return this.session(user);
  }
}
