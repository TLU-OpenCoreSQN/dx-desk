// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  canChoosePriority,
  getAllowedTransitions,
  isTicketStatus,
  isTransitionAllowed,
  RESOLUTION_NOTE_MAX,
  STATUS_ICONS,
  STATUS_LABELS,
  STATUS_TONES,
  STATUS_TRANSITIONS,
  statusLabel,
  TICKET_STATUSES,
  TRANSITION_EDGES,
  validateResolutionNote,
} from '../lib/ticketWorkflow';
import { UserRole } from '../types/api';

const sortedTos = (status: string, roles: UserRole[], isRequester: boolean) =>
  getAllowedTransitions(status, roles, { isRequester })
    .map((a) => a.to)
    .sort();

describe('ticketWorkflow — máy trạng thái (hợp đồng tuần 3)', () => {
  it('đủ 9 trạng thái chữ thường', () => {
    expect([...TICKET_STATUSES].sort()).toEqual(
      ['assigned', 'cancelled', 'closed', 'in_progress', 'new', 'pending_approval', 'resolved', 'triaged', 'waiting_user'].sort()
    );
  });

  it('đồ thị chuyển tiếp khớp hợp đồng', () => {
    expect(STATUS_TRANSITIONS).toEqual({
      new: ['triaged', 'cancelled', 'pending_approval'],
      triaged: ['assigned', 'cancelled'],
      assigned: ['in_progress', 'pending_approval', 'cancelled'],
      in_progress: ['waiting_user', 'resolved', 'pending_approval'],
      waiting_user: ['in_progress', 'cancelled'],
      pending_approval: ['assigned', 'new'],
      resolved: ['closed', 'in_progress'],
      closed: [],
      cancelled: [],
    });
  });

  it('mọi cạnh theo vai trò đều thuộc đồ thị trạng thái', () => {
    for (const edge of TRANSITION_EDGES) {
      expect(STATUS_TRANSITIONS[edge.from]).toContain(edge.to);
    }
  });

  it('isTransitionAllowed chấp nhận cạnh hợp lệ và chặn cạnh vô hiệu', () => {
    expect(isTransitionAllowed('new', 'triaged')).toBe(true);
    expect(isTransitionAllowed('pending_approval', 'new')).toBe(true);
    expect(isTransitionAllowed('resolved', 'closed')).toBe(true);
    expect(isTransitionAllowed('new', 'resolved')).toBe(false);
    expect(isTransitionAllowed('closed', 'new')).toBe(false);
    expect(isTransitionAllowed('cancelled', 'new')).toBe(false);
    expect(isTransitionAllowed('khong_ton_tai', 'new')).toBe(false);
  });

  it('nhãn tiếng Việt, icon và màu phủ đủ 9 trạng thái', () => {
    for (const status of TICKET_STATUSES) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(STATUS_LABELS[status]).not.toBe(status);
      expect(STATUS_ICONS[status]).toBeTruthy();
      expect(STATUS_TONES[status].badge).toContain('text-');
    }
    expect(statusLabel('waiting_user')).toBe('Chờ phản hồi');
    expect(statusLabel('pending_approval')).toBe('Chờ phê duyệt');
    expect(statusLabel('unknown_value')).toBe('unknown_value');
    expect(isTicketStatus('in_progress')).toBe(true);
    expect(isTicketStatus('open')).toBe(false);
  });
});

describe('ticketWorkflow — nút thao tác theo vai trò và trạng thái', () => {
  const EMPLOYEE_REQUESTER: Record<string, string[]> = {
    new: ['cancelled'],
    triaged: ['cancelled'],
    assigned: ['cancelled'],
    in_progress: [],
    waiting_user: ['cancelled', 'in_progress'],
    pending_approval: [],
    resolved: ['closed'],
    closed: [],
    cancelled: [],
  };

  const EMPLOYEE_OTHER: Record<string, string[]> = Object.fromEntries(
    TICKET_STATUSES.map((status) => [status, []])
  );

  const AGENT: Record<string, string[]> = {
    new: ['cancelled', 'pending_approval', 'triaged'],
    triaged: ['assigned', 'cancelled'],
    assigned: ['cancelled', 'in_progress', 'pending_approval'],
    in_progress: ['pending_approval', 'resolved', 'waiting_user'],
    waiting_user: ['cancelled', 'in_progress'],
    pending_approval: ['assigned'],
    resolved: ['in_progress'],
    closed: [],
    cancelled: [],
  };

  const MANAGER: Record<string, string[]> = {
    ...AGENT,
    pending_approval: ['assigned', 'new'],
  };

  it('ma trận Employee (chủ phiếu)', () => {
    for (const status of TICKET_STATUSES) {
      expect(sortedTos(status, ['Employee'], true), `Employee/requester @ ${status}`).toEqual(
        EMPLOYEE_REQUESTER[status]
      );
    }
  });

  it('Employee không phải chủ phiếu thì không có nút chuyển trạng thái nào', () => {
    for (const status of TICKET_STATUSES) {
      expect(sortedTos(status, ['Employee'], false), `Employee/other @ ${status}`).toEqual(
        EMPLOYEE_OTHER[status]
      );
    }
  });

  it('ma trận Agent theo các cạnh quy trình', () => {
    for (const status of TICKET_STATUSES) {
      expect(sortedTos(status, ['Agent'], false), `Agent @ ${status}`).toEqual(AGENT[status]);
    }
  });

  it('Manager bằng Agent cộng duyệt/từ chối pending_approval', () => {
    for (const status of TICKET_STATUSES) {
      expect(sortedTos(status, ['Manager'], false), `Manager @ ${status}`).toEqual(MANAGER[status]);
    }
    const reject = getAllowedTransitions('pending_approval', ['Manager']).find((a) => a.to === 'new');
    expect(reject?.label).toBe('Từ chối yêu cầu');
  });

  it('trạng thái lạ hoặc đóng/canceled không có nút nào', () => {
    expect(getAllowedTransitions('khong_ton_tai', ['Manager', 'Agent', 'Employee'])).toEqual([]);
    expect(getAllowedTransitions('closed', ['Manager'])).toEqual([]);
    expect(getAllowedTransitions('cancelled', ['Agent', 'Employee'])).toEqual([]);
  });

  it('nhiều vai trò cộng gộp quyền', () => {
    expect(sortedTos('new', ['Employee', 'Agent'], true)).toEqual(['cancelled', 'pending_approval', 'triaged']);
  });

  it('cạnh sang resolved bắt buộc resolution_note, các cạnh khác không', () => {
    const resolve = getAllowedTransitions('in_progress', ['Agent']).find((a) => a.to === 'resolved');
    expect(resolve?.resolutionNoteRequired).toBe(true);
    const waiting = getAllowedTransitions('in_progress', ['Agent']).find((a) => a.to === 'waiting_user');
    expect(waiting?.resolutionNoteRequired).toBeFalsy();
    const cancel = getAllowedTransitions('new', ['Employee'], { isRequester: true })[0];
    expect(cancel.resolutionNoteRequired).toBeFalsy();
  });
});

describe('ticketWorkflow — priority và resolution_note', () => {
  it('critical chỉ chọn được khi có vai trò Manager', () => {
    expect(canChoosePriority('critical', ['Manager'])).toBe(true);
    expect(canChoosePriority('critical', ['Employee', 'Agent', 'Manager'])).toBe(true);
    expect(canChoosePriority('critical', ['Employee'])).toBe(false);
    expect(canChoosePriority('critical', ['Agent'])).toBe(false);
    expect(canChoosePriority('critical', [])).toBe(false);
    for (const p of ['low', 'normal', 'high'] as const) {
      expect(canChoosePriority(p, ['Employee'])).toBe(true);
    }
  });

  it('validateResolutionNote 5..2000 ký tự, thông báo tiếng Việt', () => {
    expect(validateResolutionNote('')).toMatch(/tối thiểu 5 ký tự/);
    expect(validateResolutionNote('   ')).toMatch(/tối thiểu 5 ký tự/);
    expect(validateResolutionNote('abcd')).toMatch(/hiện tại: 4/);
    expect(validateResolutionNote('abcde')).toBeNull();
    expect(validateResolutionNote('   abcde  ')).toBeNull();
    expect(validateResolutionNote('x'.repeat(RESOLUTION_NOTE_MAX))).toBeNull();
    expect(validateResolutionNote('x'.repeat(RESOLUTION_NOTE_MAX + 1))).toMatch(/tối đa 2000 ký tự/);
  });
});

interface DbEdge {
  roles: string[];
  requesterAllowed: boolean;
}

/** Nguồn sự thật mức DB: bảng private.ticket_transitions khai báo trong migration 003. */
function migration003(): string {
  // đọc bằng node:fs (vitest chạy trong Node) vì vite chặn import file ngoài gốc apps/web.
  let dir = process.cwd();
  for (let step = 0; step < 5; step++) {
    const candidate = resolve(dir, 'db/migrations/003_ticket_workflow.sql');
    if (existsSync(candidate)) return readFileSync(candidate, 'utf8');
    dir = resolve(dir, '..');
  }
  throw new Error('Không tìm thấy db/migrations/003_ticket_workflow.sql');
}

function dbEdges(): Map<string, DbEdge> {
  const sql = migration003();
  const start = sql.indexOf('INSERT INTO private.ticket_transitions');
  if (start === -1) throw new Error('Không thấy INSERT INTO private.ticket_transitions trong migration 003');
  const block = sql.slice(start).split(/;\s*$/m)[0];
  const rows = block.matchAll(
    /\('([a-z_]+)', '([a-z_]+)', (?:ARRAY\[([^\]]*)\]|'\{\}'), (true|false)\)/g
  );
  const edges = new Map<string, DbEdge>();
  for (const [, from, to, roles, requester] of rows) {
    edges.set(`${from}->${to}`, {
      roles: roles ? [...roles.matchAll(/'([A-Za-z]+)'/g)].map((match) => match[1]) : [],
      requesterAllowed: requester === 'true',
    });
  }
  return edges;
}

describe('ticketWorkflow — nút UI không được vượt quá máy trạng thái trong DB', () => {
  const edges = dbEdges();
  it('mọi tác vụ DB cho phép đều có nút UI, kể cả staff tự tạo phiếu', () => {
    for (const status of TICKET_STATUSES) for (const role of ['Employee','Agent','Manager'] as const) {
      for (const owned of [true,false]) {
        const expected = [...edges.entries()].filter(([key, rule]) => key.startsWith(status+'->')
          && (rule.roles.includes(role) || owned && rule.requesterAllowed)).map(([key]) => key.split('->')[1]).sort();
        expect(sortedTos(status,[role],owned), `${status}/${role}/owner=${owned}`).toEqual(expected);
      }
    }
  });

  it('đồ thị STATUS_TRANSITIONS khớp 1:1 tập cạnh của bảng ticket_transitions', () => {
    expect(edges.size).toBe(17);
    const graph = Object.entries(STATUS_TRANSITIONS)
      .flatMap(([from, tos]) => tos.map((to) => `${from}->${to}`))
      .sort();
    expect(graph).toEqual([...edges.keys()].sort());
  });

  it('mỗi cạnh hiển thị được DB cho phép, đúng vai trò hoặc đúng tư cách chủ phiếu', () => {
    for (const edge of TRANSITION_EDGES) {
      const db = edges.get(`${edge.from}->${edge.to}`);
      expect(db, `DB thiếu cạnh ${edge.from}->${edge.to}`).toBeDefined();
      if (!db) continue;
      if (edge.requesterOnly) {
        expect(db.requesterAllowed, `DB chặn chủ phiếu ở ${edge.from}->${edge.to}`).toBe(true);
      } else {
        for (const role of edge.roles) expect(db.roles, `${role} ${edge.from}->${edge.to}`).toContain(role);
      }
    }
  });

  it('mọi cạnh tiến tới resolved đều bắt buộc ghi mô tả cách giải quyết', () => {
    for (const edge of TRANSITION_EDGES.filter((item) => item.to === 'resolved')) {
      expect(edge.resolutionNoteRequired, `${edge.from}->resolved`).toBe(true);
    }
  });
});
