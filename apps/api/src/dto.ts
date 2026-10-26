// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
const Trim = () => Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value);

export const TICKET_STATUS_VALUES = [
  'new', 'triaged', 'assigned', 'in_progress', 'waiting_user',
  'pending_approval', 'resolved', 'closed', 'cancelled',
] as const;

export class CreateTicket {
  @IsUUID() category_id!: string;
  @Trim() @IsString() @Length(5, 200) title!: string;
  @Trim() @IsString() @Length(10, 5000) description!: string;
  @IsOptional() @IsIn(['low', 'normal', 'high', 'critical']) priority?: string;
  // W3-02: dữ liệu trường động theo categories.requirement_fields; key/value được
  // kiểm tra ở controller (không tin cấu trúc JSON lồng nhau).
  @IsOptional() @IsObject() fields?: Record<string, unknown>;
}
export class UpdateTicketStatus {
  @IsIn(TICKET_STATUS_VALUES) to!: string;
  @Trim() @IsOptional() @IsString() @Length(1, 2000) note?: string;
  // W3-01: bắt buộc khi chuyển sang 'resolved' (5..2000); các cạnh khác bị máy trạng thái chặn trước.
  @Trim() @IsOptional() @IsString() @Length(5, 2000) resolution_note?: string;
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
