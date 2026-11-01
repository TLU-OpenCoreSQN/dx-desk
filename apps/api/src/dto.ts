// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { Transform } from 'class-transformer';
import { IsBase64, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
const Trim = () => Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value);

export const TICKET_STATUS_VALUES = [
  'new', 'triaged', 'assigned', 'in_progress', 'waiting_user',
  'pending_approval', 'resolved', 'closed', 'cancelled',
] as const;

// W3-06/ADR 0007: trần dung lượng tệp đính kèm — khớp chính xác CHECK của
// attachments.size_bytes trong 001_schema.sql (10 MiB).
export const MAX_ATTACHMENT_BYTES = 10485760;
// Trần độ dài chuỗi base64 = ceil(10 MiB / 3) * 4, dựng TRƯỚC khi giải mã để chặn
// cấp phát từ một payload khổng lồ (kiểm tra kích thước thật vẫn dựa trên byte đã giải mã).
const MAX_ATTACHMENT_BASE64_CHARS = 13981016;
// Allow-list content type: chặn loại tệp NGAY ở DTO, trước khi stream tới clamd.
export const ALLOWED_CONTENT_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain',
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

/**
 * W3-06: body JSON { file_name, content_type, content_base64 } đã chốt trong contract.
 * Browser và parser API buffer body trong RAM; INSTREAM chỉ là giao thức với clamd.
 * Nội dung nhị phân đi nền base64; giới hạn kích thước thật được kiểm trên byte SAU
 * khi giải mã ở controller. file_name KHÔNG dùng làm đường dẫn/object key (server sinh key).
 */
export class UploadAttachment {
  @Trim() @IsString() @Length(1, 255) file_name!: string;
  @IsIn(ALLOWED_CONTENT_TYPES) content_type!: string;
  @IsBase64() @Length(1, MAX_ATTACHMENT_BASE64_CHARS) content_base64!: string;
}
