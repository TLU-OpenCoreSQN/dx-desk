// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// W5-02: "đơn vị" của người dùng là thuộc tính Keycloak `department`, đi vào access token để
// PostgreSQL xác định quản lý trực tiếp (migration 018). Realm JSON chỉ được nhập khi volume
// Keycloak còn trống, nên script này đưa realm đang chạy về cùng cấu hình. Chạy lặp an toàn:
// không ghi đè đơn vị quản trị viên đã gán, không in mật khẩu hay token.

export const DEPARTMENT_ATTRIBUTE = 'department';
export const DEPARTMENT_PATTERN = '^[a-z0-9]+(-[a-z0-9]+)*$';
/** Client cấp token mà PostgREST/API chấp nhận cho người dùng cuối. */
export const DEPARTMENT_CLIENTS = ['dxdesk-web'];
/** Đơn vị giả lập của tài khoản demo; employee.b ở đơn vị khác để thấy phạm vi của Manager. */
export const DEMO_DEPARTMENTS = {
  'employee.a': 'phong-hanh-chinh', 'manager.1': 'phong-hanh-chinh', 'employee.b': 'phong-ke-toan',
  'agent.1': 'phong-cntt', 'agent.2': 'phong-cntt',
};

/** Chỉ quản trị viên sửa được: người dùng tự đổi đơn vị là tự chọn người duyệt cho mình. */
export const departmentProfileAttribute = {
  name: DEPARTMENT_ATTRIBUTE, displayName: 'Đơn vị',
  validations: { length: { max: 63 }, pattern: { pattern: DEPARTMENT_PATTERN, 'error-message': 'Mã đơn vị chỉ gồm chữ thường, số và dấu gạch nối.' } },
  permissions: { view: ['admin', 'user'], edit: ['admin'] }, multivalued: false,
};
export const departmentMapper = {
  name: DEPARTMENT_ATTRIBUTE, protocol: 'openid-connect', protocolMapper: 'oidc-usermodel-attribute-mapper',
  config: { 'user.attribute': DEPARTMENT_ATTRIBUTE, 'claim.name': DEPARTMENT_ATTRIBUTE, 'jsonType.label': 'String',
    'access.token.claim': 'true', 'id.token.claim': 'false', 'userinfo.token.claim': 'false', multivalued: 'false' },
};

/** Thêm thuộc tính vào user profile hiện có; trả null khi không phải đổi gì. */
export function withDepartment(profile) {
  const attributes = profile.attributes ?? [];
  const current = attributes.find(attribute => attribute.name === DEPARTMENT_ATTRIBUTE);
  if (current && JSON.stringify(current.permissions?.edit) === JSON.stringify(['admin'])) return null;
  return { ...profile, attributes: [...attributes.filter(attribute => attribute !== current), departmentProfileAttribute] };
}

async function json(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw Object.assign(new Error(`Directory setup HTTP ${response.status}`), { status: response.status });
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function setupDepartments(env, clients = DEPARTMENT_CLIENTS) {
  const base = env.KEYCLOAK_PUBLIC_URL;
  const token = await json(base + '/realms/master/protocol/openid-connect/token', { method: 'POST', body: new URLSearchParams({
    client_id: 'admin-cli', grant_type: 'password', username: env.KEYCLOAK_ADMIN, password: env.KEYCLOAK_ADMIN_PASSWORD,
  }) });
  const headers = { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json' };
  const admin = (path, method = 'GET', body) => json(base + '/admin/realms/' + env.KEYCLOAK_REALM + path,
    { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

  const profile = withDepartment(await admin('/users/profile'));
  if (profile) await admin('/users/profile', 'PUT', profile);

  for (const clientId of clients) {
    const [client] = await admin('/clients?clientId=' + encodeURIComponent(clientId));
    if (!client) continue;
    const mappers = await admin('/clients/' + client.id + '/protocol-mappers/models');
    const current = mappers.find(mapper => mapper.name === departmentMapper.name);
    if (current) await admin('/clients/' + client.id + '/protocol-mappers/models/' + current.id, 'PUT', { ...current, ...departmentMapper });
    else await admin('/clients/' + client.id + '/protocol-mappers/models', 'POST', departmentMapper);
  }

  let assigned = 0;
  for (const [username, department] of Object.entries(DEMO_DEPARTMENTS)) {
    const [user] = await admin('/users?exact=true&username=' + encodeURIComponent(username));
    if (!user || user.attributes?.[DEPARTMENT_ATTRIBUTE]?.[0]) continue;
    await admin('/users/' + user.id, 'PUT', { ...user, attributes: { ...user.attributes, [DEPARTMENT_ATTRIBUTE]: [department] } });
    assigned++;
  }
  console.log(`Keycloak: thuộc tính đơn vị sẵn sàng (${assigned} tài khoản demo vừa được gán).`);
}
