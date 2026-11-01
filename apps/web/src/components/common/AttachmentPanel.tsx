// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import React, { useCallback, useEffect, useState } from 'react';
import { Attachment } from '../../types/api';
import { getAttachments, getAttachmentDownload, uploadAttachment } from '../../services/api';
import { ATTACHMENT_TYPES, fileError } from '../../lib/attachments';
import { ErrorMessage } from './ErrorMessage';

const labels = { pending: 'Đang chờ hoàn tất', clean: 'An toàn', infected: 'Bị chặn: mã độc', failed: 'Tải lên thất bại' };
export const AttachmentPanel: React.FC<{ ticketId: string }> = ({ ticketId }) => {
  const [items, setItems] = useState<Attachment[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [readyLink, setReadyLink] = useState<{ url: string; name: string } | null>(null);
  const reload = useCallback(async () => {
    setError(null);
    try { setItems((await getAttachments(ticketId)).data ?? []); } catch (err) { setError(err); }
  }, [ticketId]);
  useEffect(() => { void reload(); setReadyLink(null); }, [reload]);
  const upload = async () => {
    if (!file || busy) return;
    setBusy(true); setError(null);
    try { await uploadAttachment(ticketId, file); setFile(null); await reload(); }
    catch (err) { setError(err); }
    finally { setBusy(false); }
  };
  const open = async (item: Attachment) => {
    setBusy(true); setError(null); setReadyLink(null);
    try { setReadyLink({ ...(await getAttachmentDownload(item.id)), name: item.file_name }); }
    catch (err) { setError(err); }
    finally { setBusy(false); }
  };
  return <section aria-label="Tệp đính kèm" className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 text-sm">
    <h2 className="font-bold">Tệp đính kèm</h2>
    {error != null && <ErrorMessage error={error} title="Không xử lý được tệp" />}
    <button type="button" onClick={() => void reload()} disabled={busy}>Làm mới danh sách tệp</button>
    <ul className="space-y-2">{items.map(item => <li key={item.id} className="flex flex-wrap gap-3 items-center">
      <span className="break-all">{item.file_name}</span>
      <span>{labels[item.scan_status]}</span>
      <span>{Number(item.size_bytes).toLocaleString('vi-VN')} byte</span>
      {item.scan_status === 'clean' && <button type="button" disabled={busy} onClick={() => void open(item)}
        className="text-teal-700 underline">Lấy liên kết tải {item.file_name}</button>}
    </li>)}</ul>
    {items.length === 0 && <p>Chưa có tệp đính kèm.</p>}
    {readyLink && <p><a href={readyLink.url} download rel="noreferrer" className="text-teal-700 underline">Tải {readyLink.name}</a>
      {' '}— liên kết có hạn 2 phút; lấy liên kết mới nếu hết hạn.</p>}
    <label className="block">Bổ sung tệp (PNG, JPEG, PDF, TXT; tối đa 10 MiB)
      <input type="file" accept={ATTACHMENT_TYPES.join(',')} disabled={busy} onChange={event => {
        const chosen = event.target.files?.[0] ?? null;
        const issue = chosen ? fileError(chosen) : null;
        setError(issue ? new Error(issue) : null); setFile(issue ? null : chosen);
      }} />
    </label>
    <button type="button" disabled={!file || busy} onClick={() => void upload()} className="text-teal-700 underline">
      {busy ? 'Đang xử lý tệp…' : 'Tải tệp lên phiếu này'}
    </button>
  </section>;
};
