// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateNested } from 'class-validator';
import { ListQuery, TICKET_STATUS_VALUES } from './dto';

export class TicketListQuery extends ListQuery {
  @IsOptional() @IsIn(['my_open', 'team_unassigned', 'team_assigned', 'pending_approval']) queue?: string;
  @IsOptional() @IsIn(TICKET_STATUS_VALUES) status?: string;
  @IsOptional() @IsUUID() team_id?: string;
  @IsOptional() @IsUUID() assignee_id?: string;
  @IsOptional() @IsIn(['me']) assignee?: string;
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
