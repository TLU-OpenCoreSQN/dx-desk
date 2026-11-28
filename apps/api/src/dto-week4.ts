// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { ListQuery, TICKET_PRIORITY_VALUES, TICKET_STATUS_VALUES } from './dto';

export class TicketListQuery extends ListQuery {
  @IsOptional() @IsIn(['my_open', 'team_unassigned', 'team_assigned', 'pending_approval']) queue?: string;
  @IsOptional() @IsIn(TICKET_STATUS_VALUES) status?: string;
  @IsOptional() @IsUUID() team_id?: string;
  @IsOptional() @IsUUID() assignee_id?: string;
  @IsOptional() @IsIn(['me']) assignee?: string;
  /** Tìm theo tiêu đề, mô tả, mã phiếu, người yêu cầu, người phụ trách hoặc nhóm (không phân biệt hoa thường). */
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsIn(TICKET_PRIORITY_VALUES) priority?: string;
  /** Chỉ phiếu đã quá hạn hoặc sắp quá hạn SLA (cùng quy ước với apps/web/src/lib/sla.ts). */
  @IsOptional() @IsIn(['breached', 'at_risk']) sla?: string;
  /** `newest` (mặc định): mới tạo trước. `sla_due`: việc gấp trước — quá hạn, sắp quá hạn, đang chạy, tạm dừng. */
  @IsOptional() @IsIn(['newest', 'sla_due']) sort?: string;
}
export class EmptyBody {}
export class ProcessEvent {
  @IsInt() @Min(1) @Max(1) schema_version!: number;
}
export class RosterMember {
  @IsUUID() team_id!: string;
  @IsUUID() user_id!: string;
  @IsString() @Length(1, 255) display_name!: string;
  @IsBoolean() active!: boolean;
}
export class SyncRoster {
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => RosterMember)
  members!: RosterMember[];
}
