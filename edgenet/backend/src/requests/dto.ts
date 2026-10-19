import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsDateString, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { PRIORITIES, Priority, STATUSES, Status } from '../entities';

export class ResourceDto {
  @IsString() @IsNotEmpty() type: string;
  @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsString() notes?: string;
}

export class CreateRequestDto {
  @IsString() @IsNotEmpty() clientName: string;
  @IsEmail() clientEmail: string;
  @IsString() @IsNotEmpty() clientCompany: string;
  @IsString() @IsNotEmpty() projectName: string;
  @IsOptional() @IsString() description?: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsIn(PRIORITIES) priority: Priority;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ResourceDto) resources: ResourceDto[];
  @IsOptional() @IsUUID() assignedEngineerId?: string;
}

export class StatusDto {
  @IsIn(STATUSES) status: Status;
  @IsOptional() @IsString() @MaxLength(500) remarks?: string;
}
export class AssignDto { @IsOptional() @IsUUID() engineerId?: string | null; }
export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
