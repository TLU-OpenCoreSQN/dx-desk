-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- Reserve durable metadata before PUT; interrupted writes remain traceable and not clean.
CREATE FUNCTION private.begin_attachment(
  p_ticket_id uuid, p_file_name text, p_object_key text, p_content_type text, p_size_bytes bigint
) RETURNS public.attachments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE result public.attachments;
BEGIN
  -- Reuse the ownership check of migration 004 within this same transaction.
  result := private.record_attachment(p_ticket_id, p_file_name, p_object_key, p_content_type, p_size_bytes, 'failed');
  UPDATE public.attachments SET scan_status = 'pending' WHERE id = result.id RETURNING * INTO result;
  RETURN result;
END
$$;

CREATE FUNCTION private.finish_attachment(p_id uuid, p_status text) RETURNS public.attachments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE result public.attachments;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('clean', 'failed') THEN
    RAISE sqlstate '22023' USING MESSAGE = 'Invalid attachment completion status';
  END IF;
  UPDATE public.attachments SET scan_status = p_status
    WHERE id = p_id AND uploaded_by = private.user_id()
      AND (scan_status = 'pending' OR (p_status = 'failed' AND scan_status = 'clean'))
    RETURNING * INTO result;
  IF NOT FOUND THEN
    RAISE sqlstate '42501' USING MESSAGE = 'Attachment cannot be completed by this user';
  END IF;
  RETURN result;
END
$$;
REVOKE ALL ON FUNCTION private.begin_attachment(uuid, text, text, text, bigint),
  private.finish_attachment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.begin_attachment(uuid, text, text, text, bigint),
  private.finish_attachment(uuid, text) TO authenticated;
