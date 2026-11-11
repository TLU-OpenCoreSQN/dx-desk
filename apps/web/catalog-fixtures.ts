// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

export const datasetLicense = 'https://creativecommons.org/publicdomain/zero/1.0/';
const requestTypes = {
  vpn: 'Kết nối VPN', account: 'Tài khoản', hardware: 'Thiết bị', software: 'Phần mềm',
  access: 'Cấp quyền hệ thống', 'system-error': 'Sự cố hệ thống',
};
const deviceTypes = { laptop: 'Máy tính xách tay', monitor: 'Màn hình', keyboard: 'Bàn phím', mouse: 'Chuột', other: 'Thiết bị khác' };
export const resourceGroups = [
  { path: 'services', label: 'Dịch vụ', type: 'Service', items: requestTypes },
  { path: 'request-types', label: 'Loại yêu cầu', type: 'DefinedTerm', items: requestTypes },
  { path: 'device-types', label: 'Loại thiết bị', type: 'Product', items: deviceTypes },
];

const dcat = 'http://www.w3.org/ns/dcat#';
const dct = 'http://purl.org/dc/terms/';
const schema = 'https://schema.org/';
const context = { dcat, dct, schema, xsd: 'http://www.w3.org/2001/XMLSchema#' };
const updated = { '@value': '2026-11-02', '@type': 'xsd:date' };
const id = (path: string) => ({ '@id': path });
const datasets = [
  ['tickets', 'Phiếu hỗ trợ', 'Mẫu phiếu VPN trước và sau khi cập nhật client trong kịch bản giả lập.'],
  ['ticket-events', 'Sự kiện phiếu hỗ trợ', 'Mẫu lịch sử phân loại, phân công, nhận việc và giải quyết của các phiếu giả lập.'],
  ['sla-policies', 'Chính sách SLA', 'Mẫu thời hạn phản hồi và xử lý theo mức ưu tiên của cấu hình demo.'],
];
export const sampleCatalog = {
  '@context': context, '@id': '/ld/catalog', '@type': 'dcat:Catalog', 'dct:title': 'Danh mục dữ liệu giả lập DX-Desk',
  'dct:modified': updated,
  'dcat:dataset': datasets.map(([code, title, description]) => ({
    '@id': `/ld/catalog#${code}`, '@type': 'dcat:Dataset', 'dct:title': title, 'dct:description': description,
    'dct:license': id(datasetLicense), 'dct:modified': updated, 'dcat:keyword': 'Dữ liệu giả lập',
    'dcat:distribution': {
      '@type': 'dcat:Distribution', 'dcat:downloadURL': id(`/data/synthetic/${code}.json`),
      'dct:license': id(datasetLicense), 'dcat:mediaType': id('https://www.iana.org/assignments/media-types/application/json'),
    },
  })),
};

export const sampleResources: Record<string, Record<string, unknown>> = Object.fromEntries(
  resourceGroups.flatMap(group => Object.entries(group.items).map(([code, name]) => {
    const path = `/ld/${group.path}/${code}`;
    return [path, { '@context': context, '@id': path, '@type': `schema:${group.type}`,
      'schema:name': name, 'schema:identifier': code }];
  })),
);

type JsonObject = Record<string, unknown>;
function objects(value: unknown): JsonObject[] {
  return (Array.isArray(value) ? value : [value]).filter((item): item is JsonObject =>
    item !== null && typeof item === 'object' && !Array.isArray(item));
}
function property(object: JsonObject, prefix: string, name: string) {
  const namespace = context[prefix as keyof typeof context];
  return object[`${prefix}:${name}`] ?? object[namespace + name] ?? object[`dcterms:${name}`] ?? object[name];
}
function literal(value: unknown): string | undefined {
  if (Array.isArray(value)) return literal(value[0]);
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const object = value as JsonObject;
    return literal(object['@id'] ?? object['@value']);
  }
}
function httpUrl(value: unknown, origin: string) {
  const raw = literal(value);
  if (!raw) return;
  const url = URL.parse(raw, origin);
  if (url && (url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === origin)) && !url.username && !url.password) {
    return url.href;
  }
}

export function catalogDatasets(document: JsonObject, origin: string) {
  return objects(property(document, 'dcat', 'dataset')).flatMap(dataset => {
    const title = literal(property(dataset, 'dct', 'title'));
    const description = literal(property(dataset, 'dct', 'description'));
    const updated = literal(property(dataset, 'dct', 'modified'));
    const distribution = objects(property(dataset, 'dcat', 'distribution')).find(item => httpUrl(property(item, 'dcat', 'downloadURL'), origin));
    const license = httpUrl(property(dataset, 'dct', 'license') ?? (distribution && property(distribution, 'dct', 'license')), origin);
    const download = distribution && httpUrl(property(distribution, 'dcat', 'downloadURL'), origin);
    return title && description && updated && license && download
      ? [{ title, description, updated, license, download, document: { '@context': document['@context'], ...dataset } }]
      : [];
  });
}

export function playgroundUrl(document: JsonObject, origin: string) {
  const { '@context': original, ...resource } = document;
  const contexts = Array.isArray(original) ? original : original ? [original] : [];
  const params = new URLSearchParams({
    'json-ld': JSON.stringify({ '@context': [...contexts, { '@base': origin + '/' }], ...resource }),
  });
  return 'https://json-ld.org/playground/?' + params.toString();
}
