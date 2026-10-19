import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { PocRequest, User } from '../entities';

export class UpdateProfileDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
}
export class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString() @MinLength(8) newPassword: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(PocRequest) private reqs: Repository<PocRequest>,
  ) {}

  async engineers(me: User) {
    const [engineers, all] = await Promise.all([
      this.users.find({ where: { organisation: me.organisation, role: 'engineer', approved: true }, order: { name: 'ASC' } }),
      this.reqs.find({ where: { organisation: me.organisation } }),
    ]);
    return engineers.map((e) => {
      const mine = all.filter((r) => r.assignedEngineer?.id === e.id);
      return {
        ...e,
        active: mine.filter((r) => r.status !== 'completed' && r.status !== 'decommissioned').length,
        completed: mine.filter((r) => r.status === 'completed').length,
        total: mine.length,
      };
    });
  }

  /** Engineers who have registered for this organisation and are waiting for approval. */
  pending(me: User) {
    return this.users.find({ where: { organisation: me.organisation, role: 'engineer', approved: false }, order: { createdAt: 'ASC' } });
  }

  async approve(me: User, id: string) {
    const res = await this.users.update({ id, organisation: me.organisation, role: 'engineer', approved: false }, { approved: true });
    if (!res.affected) throw new NotFoundException('No pending registration with that id in your organisation.');
    return this.users.findOneBy({ id });
  }

  /** Removes a registration that was never approved. It never had access, so there is nothing else to clean up,
   *  and the person can register again with the same email. */
  async reject(me: User, id: string) {
    const res = await this.users.delete({ id, organisation: me.organisation, role: 'engineer', approved: false });
    if (!res.affected) throw new NotFoundException('No pending registration with that id in your organisation.');
    return { ok: true };
  }

  async updateProfile(me: User, dto: UpdateProfileDto) {
    const email = dto.email.toLowerCase().trim();
    if (email !== me.email && (await this.users.findOneBy({ email }))) {
      throw new ConflictException('Another account already uses this email.');
    }
    await this.users.update(me.id, { name: dto.name.trim(), email });
    return this.users.findOneBy({ id: me.id });
  }

  async changePassword(me: User, dto: ChangePasswordDto) {
    const u = await this.users.createQueryBuilder('u').addSelect('u.passwordHash').where('u.id = :id', { id: me.id }).getOne();
    if (!(await bcrypt.compare(dto.currentPassword, u.passwordHash))) {
      throw new BadRequestException('Current password is incorrect.');
    }
    await this.users.update(me.id, { passwordHash: await bcrypt.hash(dto.newPassword, 10) });
    return { ok: true };
  }
}
