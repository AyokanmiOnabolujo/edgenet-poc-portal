import { applyDecorators } from '@nestjs/common';
import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { RESOURCE_STATES, ResourceState } from '../entities';

/** A real calendar date written as YYYY-MM-DD. */
export const IsDay = () => applyDecorators(Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Dates must look like 2026-11-30.' }), IsDateString({ strict: true }));

export class CreateResourceDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsString() @IsNotEmpty() @MaxLength(60) type: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(30) unit?: string;
  @IsOptional() @IsString() @MaxLength(500) specs?: string;
  @IsInt() @Min(1) @Max(100000) capacity: number;
}

export class UpdateResourceDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(500) specs?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100000) capacity?: number;
  @IsOptional() @IsIn(RESOURCE_STATES) state?: ResourceState;
}

export class WindowDto {
  @IsOptional() @IsDay() start?: string;
  @IsOptional() @IsDay() end?: string;
}

export class AllocateDto {
  @IsUUID() resourceId: string;
  @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsDay() startDate?: string;
  @IsOptional() @IsDay() endDate?: string;
}
