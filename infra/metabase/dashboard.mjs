// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

export const dashboardName = 'DX-Desk · IT nghẽn ở đâu?';
export const questions = [
  { name: 'Phiếu đang mở', display: 'scalar', sql: 'SELECT open_tickets FROM reporting.ticket_overview', width: 6 },
  { name: 'Phiếu đã giải quyết', display: 'scalar', sql: 'SELECT resolved_tickets FROM reporting.ticket_overview', width: 6 },
  { name: 'Giờ xử lý trung bình', display: 'scalar', sql: 'SELECT average_resolution_hours FROM reporting.ticket_overview', width: 6 },
  { name: 'Phiếu vi phạm SLA', display: 'scalar', sql: 'SELECT breached_tickets FROM reporting.ticket_overview', width: 6 },
  { name: 'Phiếu theo loại yêu cầu', display: 'bar', sql: 'SELECT category_name, sum(tickets) AS tickets FROM reporting.ticket_distribution GROUP BY category_name ORDER BY tickets DESC, category_name', width: 12 },
  { name: 'Phiếu theo nhóm xử lý', display: 'bar', sql: 'SELECT team_name, sum(tickets) AS tickets FROM reporting.ticket_distribution GROUP BY team_name ORDER BY tickets DESC, team_name', width: 12 },
  { name: 'Số phiếu theo tuần', display: 'line', sql: 'SELECT week_start, tickets FROM reporting.ticket_volume_weekly ORDER BY week_start', width: 12 },
  { name: 'Tỷ lệ thao tác thủ công theo tuần (%)', display: 'line', sql: 'SELECT week_start, manual_percent FROM reporting.automation_weekly ORDER BY week_start', width: 12 },
  { name: 'Lượt tự phục vụ theo tuần', display: 'line', sql: 'SELECT week_start, sum(resolutions) AS resolutions FROM reporting.self_service_weekly GROUP BY week_start ORDER BY week_start', width: 12 },
  { name: 'Đề nghị thiết bị', display: 'table', sql: 'SELECT device_type, status, requests, units FROM reporting.device_requests_summary ORDER BY device_type, status', width: 12 },
  { name: 'Bước xử lý theo tác nhân theo tuần (H-P-D-I)', display: 'bar', sql: 'SELECT week_start, human_steps AS "Người", system_steps AS "Hệ thống", ai_steps AS "AI" FROM reporting.automation_weekly ORDER BY week_start', width: 24 },
  { name: 'VPN client 4.2 · kịch bản giả lập', display: 'table', sql: 'SELECT tickets_before, tickets_after, increase_percent, hours_before, hours_after, client_4_2_percent FROM reporting.vpn_demo_scenario', width: 24 },
];

export function dashboardCards(cards, current = []) {
  let row = 0;
  let col = 0;
  return cards.map(({ id: cardId, width }, index) => {
    const height = width === 6 ? 3 : 5;
    const existing = current.find(card => card.card_id === cardId);
    const card = { id: existing?.id ?? -(index + 1), card_id: cardId, row, col, size_x: width,
      size_y: height, series: [], parameter_mappings: [], visualization_settings: {} };
    col += width;
    if (col === 24) {
      col = 0;
      row += height;
    }
    return card;
  });
}
