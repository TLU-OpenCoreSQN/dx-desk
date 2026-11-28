// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { useState, type FormEvent } from 'react';
import { createRequest } from './rest';
import { DEVICE_LABELS, validateRequest, type DeviceRequest, type DeviceType } from './workflow';
import { alertClass, buttonClass, fieldClass as field } from './ui';

export function RequestForm({ onCreated }: { onCreated: (request: DeviceRequest) => void }) {
  const [deviceType, setDeviceType] = useState<DeviceType>('laptop');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = { device_type: deviceType, reason, quantity: Number(quantity) };
    const found = validateRequest(input);
    setErrors(found);
    setFailure(null);
    setSent(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const created = await createRequest(input);
      onCreated(created);
      setReason('');
      setQuantity('1');
      setSent(created.id);
    } catch (error) {
      setFailure((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3">
      <div>
        <label htmlFor="device-type" className="text-sm font-medium">Loại thiết bị</label>
        <select id="device-type" value={deviceType} onChange={event => setDeviceType(event.target.value as DeviceType)} className={field}>
          {Object.entries(DEVICE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="quantity" className="text-sm font-medium">Số lượng</label>
        <input id="quantity" type="number" min={1} max={10} inputMode="numeric" value={quantity}
          onChange={event => setQuantity(event.target.value)}
          aria-invalid={!!errors.quantity} aria-describedby={errors.quantity ? 'quantity-error' : undefined} className={field} />
        {errors.quantity && <p id="quantity-error" className="mt-1 text-xs text-status-danger">{errors.quantity}</p>}
      </div>
      <div>
        <label htmlFor="reason" className="text-sm font-medium">Lý do</label>
        <textarea id="reason" rows={4} maxLength={2000} value={reason} onChange={event => setReason(event.target.value)}
          placeholder="Ví dụ: màn hình hiện tại bị sọc, cần thay để làm báo cáo."
          aria-invalid={!!errors.reason} aria-describedby={errors.reason ? 'reason-error' : undefined} className={field} />
        {errors.reason && <p id="reason-error" className="mt-1 text-xs text-status-danger">{errors.reason}</p>}
      </div>
      <p className="text-xs text-content-muted">Đề nghị được gửi tới quản lý trực tiếp của đơn vị bạn; sau khi duyệt, IT chuẩn bị và bàn giao.</p>
      {failure && <p role="alert" className={alertClass.danger}>{failure}</p>}
      {sent && <p role="status" className={alertClass.success}>Đã gửi đề nghị, chờ quản lý duyệt.</p>}
      <button type="submit" disabled={busy}
        className={buttonClass('primary', 'md')}>
        {busy ? 'Đang gửi…' : 'Gửi đề nghị'}
      </button>
    </form>
  );
}
