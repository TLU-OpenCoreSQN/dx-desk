// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
const Trim = () => Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value);

export class CreateTicket {
  @IsUUID() category_id!: string;
  @Trim() @IsString() @Length(5, 200) title!: string;
  @Trim() @IsString() @Length(10, 5000) description!: string;
  @IsOptional() @IsIn(['low', 'normal', 'high', 'critical']) priority?: string;
}
export class CreateDeviceRequest {
  @IsIn(['laptop', 'monitor', 'keyboard', 'mouse', 'other']) device_type!: string;
  @Trim() @IsString() @Length(10, 2000) reason!: string;
  @IsOptional() @IsInt() @Min(1) @Max(10) quantity?: number;
}
export class ListQuery {
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100)
  limit: number = 25;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(0) @Max(100000)
  offset: number = 0;
}
