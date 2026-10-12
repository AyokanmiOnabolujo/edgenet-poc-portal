import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { Role } from '../entities';

export class RegisterDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsIn(['account_manager', 'engineer']) role: Role;
  @IsString() @MinLength(2) organisation: string;
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}
