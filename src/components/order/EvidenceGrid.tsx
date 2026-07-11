import { useCallback, useEffect, useRef, useState } from 'react'
import { App, Button, Input, Modal, Spin } from 'antd'
import { privateGet, privatePost } from '@/api/api'
import type { DisputeEvidence } from '@/types/order'
import { resolveEvidenceFileUrl, resolveEvidencePreviewUrl } from '@/utils/evidenceUrl'

interface EvidenceGridProps {
  disputeId: string
  canUpload: boolean
}

type EvidenceListResponse = DisputeEvidence[] | { data: DisputeEvidence[] }

type EvidenceFileType = DisputeEvidence['file_type']

interface UploadEvidenceBody {
  object_key: string
  file_type: EvidenceFileType
  description?: string
}

interface EvidencePresignResponse {
  object_key: string
  upload_url: string
  http_method?: string
  form_fields?: Record<string, string> | null
  max_size?: number
  expires_at?: string
}

const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024

const EVIDENCE_CONTENT_TYPES: Record<string, EvidenceFileType> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'application/pdf': 'document',
  'video/mp4': 'video',
}

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
}

function extractEvidence(data: EvidenceListResponse | undefined): DisputeEvidence[] {
  if (!data) return []
  return Array.isArray(data) ? data : data.data
}

function getEvidenceContentType(file: File): string | null {
  if (file.type === 'image/jpg') return 'image/jpeg'
  if (file.type && EVIDENCE_CONTENT_TYPES[file.type]) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_CONTENT_TYPES[ext] ?? null
}

function detectFileType(file: File): EvidenceFileType {
  const contentType = getEvidenceContentType(file)
  return contentType ? fileTypeFromContentType(contentType) : 'document'
}

function fileTypeFromContentType(contentType: string): EvidenceFileType {
  return EVIDENCE_CONTENT_TYPES[contentType] ?? 'document'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function uploadEvidenceBinary(presign: EvidencePresignResponse, file: File, contentType: string) {
  const method = (presign.http_method ?? (presign.form_fields ? 'POST' : 'PUT')).toUpperCase()

  if (method === 'POST') {
    const form = new FormData()
    const fields = presign.form_fields ?? {}
    Object.entries(fields).forEach(([key, value]) => {
      form.append(key, value)
    })
    if (!Object.keys(fields).some((key) => key.toLowerCase() === 'key')) {
      form.append('key', presign.object_key)
    }
    if (!Object.keys(fields).some((key) => key.toLowerCase() === 'content-type')) {
      form.append('Content-Type', contentType)
    }
    form.append('file', file)

    const res = await fetch(presign.upload_url, { method: 'POST', body: form })
    if (!res.ok) throw new Error('upload_failed')
    return
  }

  const res = await fetch(presign.upload_url, {
    method,
    headers: { 'Content-Type': contentType },
    body: file,
  })
  if (!res.ok) throw new Error('upload_failed')
}

function EvidenceTile({ evidence }: { evidence: DisputeEvidence }) {
  const [mediaFailed, setMediaFailed] = useState(false)
  const fileUrl = resolveEvidenceFileUrl(evidence)
  const mediaUrl = resolveEvidencePreviewUrl(evidence)
  const openUrl = fileUrl ?? mediaUrl
  const canPreviewMedia = mediaUrl !== null
  const description = evidence.description ?? 'Evidence'

  function handleClick() {
    if (openUrl) {
      window.open(openUrl, '_blank', 'noopener,noreferrer')
    }
  }

  function renderFallback(kind: string) {
    return (
      <>
        <span style={{ fontSize: 12, fontWeight: 700 }} aria-hidden="true">{kind}</span>
        <span style={{ fontSize: 10, textAlign: 'center', padding: '0 4px', wordBreak: 'break-word' }}>
          {description}
        </span>
      </>
    )
  }

  if (evidence.file_type === 'image') {
    return (
      <button
        type="button"
        className="evidence-tile"
        onClick={handleClick}
        disabled={!openUrl}
        aria-label={evidence.description ?? 'Xem ảnh bằng chứng'}
        title={evidence.description ?? undefined}
        style={!canPreviewMedia || mediaFailed ? { flexDirection: 'column', gap: 4 } : undefined}
      >
        {canPreviewMedia && !mediaFailed ? (
          <img
            src={mediaUrl ?? undefined}
            alt={description}
            onError={() => setMediaFailed(true)}
          />
        ) : renderFallback('IMG')}
      </button>
    )
  }

  if (evidence.file_type === 'video') {
    return (
      <button
        type="button"
        className="evidence-tile evidence-tile--video"
        onClick={handleClick}
        disabled={!openUrl}
        aria-label={evidence.description ?? 'Xem video bằng chứng'}
        title={evidence.description ?? undefined}
        style={!canPreviewMedia || mediaFailed ? { flexDirection: 'column', gap: 4 } : undefined}
      >
        {canPreviewMedia && !mediaFailed ? (
          <img src={mediaUrl ?? undefined} alt="" aria-hidden="true" onError={() => setMediaFailed(true)} />
        ) : renderFallback('VID')}
      </button>
    )
  }

  return (
    <button
      type="button"
      className="evidence-tile"
      onClick={handleClick}
      disabled={!openUrl}
      aria-label={evidence.description ?? 'Tải tài liệu bằng chứng'}
      title={evidence.description ?? undefined}
      style={{ flexDirection: 'column', gap: 4 }}
    >
      {renderFallback('DOC')}
    </button>
  )
}

export function EvidenceGrid({ disputeId, canUpload }: EvidenceGridProps) {
  const { message } = App.useApp()
  const [items, setItems] = useState<DisputeEvidence[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<EvidenceFileType>('image')
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchEvidence = useCallback(async () => {
    setLoading(true)
    try {
      const res = await privateGet<EvidenceListResponse>(`/disputes/${disputeId}/evidence`)
      setItems(extractEvidence(res.data))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [disputeId])

  useEffect(() => {
    fetchEvidence()
  }, [fetchEvidence])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    const contentType = getEvidenceContentType(file)
    if (!contentType) {
      message.warning('Chỉ hỗ trợ JPEG, PNG, WebP, PDF hoặc MP4.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      message.warning('File bằng chứng không được vượt quá 5MB.')
      e.target.value = ''
      return
    }
    setSelectedFile(file)
    setFileType(detectFileType(file))
    setUploadOpen(true)
    e.target.value = ''
  }

  function handleAddClick() {
    fileInputRef.current?.click()
  }

  function handleCloseModal() {
    setUploadOpen(false)
    setSelectedFile(null)
    setDescription('')
    setFileType('image')
  }

  async function handleUpload() {
    if (!selectedFile) {
      message.warning('Vui lòng chọn file bằng chứng.')
      return
    }
    const contentType = getEvidenceContentType(selectedFile)
    if (!contentType) {
      message.warning('Chỉ hỗ trợ JPEG, PNG, WebP, PDF hoặc MP4.')
      return
    }

    setUploading(true)
    try {
      const presignRes = await privatePost<EvidencePresignResponse>(
        `/disputes/${disputeId}/evidence/presign`,
        { content_type: contentType },
      )
      const presign = presignRes.data
      if (!presign?.object_key || !presign.upload_url) {
        throw new Error('invalid_presign')
      }
      const maxSize = presign.max_size ?? MAX_EVIDENCE_BYTES
      if (selectedFile.size > maxSize) {
        message.warning(`File bằng chứng không được vượt quá ${formatFileSize(maxSize)}.`)
        return
      }
      await uploadEvidenceBinary(presign, selectedFile, contentType)
      const body: UploadEvidenceBody = {
        object_key: presign.object_key,
        file_type: fileTypeFromContentType(contentType),
        ...(description.trim() ? { description: description.trim() } : {}),
      }
      await privatePost(`/disputes/${disputeId}/evidence`, body)
      message.success('Đã thêm bằng chứng')
      handleCloseModal()
      await fetchEvidence()
    } catch {
      message.error('Không thể thêm bằng chứng. Vui lòng thử lại.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }} aria-label="Đang tải bằng chứng">
        <Spin />
      </div>
    )
  }

  const isEmpty = items.length === 0 && !canUpload

  if (isEmpty) {
    return (
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-muted)' }}>
        Chưa có bằng chứng nào.
      </p>
    )
  }

  return (
    <div className="evidence-grid" role="list" aria-label="Bằng chứng khiếu nại">
      {items.map((ev) => (
        <div key={ev.id} role="listitem">
          <EvidenceTile evidence={ev} />
        </div>
      ))}
      {canUpload && (
        <div role="listitem">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,.jpg,.jpeg,.png,.webp,.pdf,.mp4"
            style={{ display: 'none' }}
            aria-hidden="true"
            tabIndex={-1}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="evidence-tile evidence-tile--add"
            aria-label="Thêm bằng chứng"
            onClick={handleAddClick}
            title="Thêm bằng chứng"
          >
            <span style={{ fontSize: 24 }} aria-hidden="true">+</span>
          </button>
        </div>
      )}
      <Modal
        title="Tải lên bằng chứng"
        open={uploadOpen}
        onCancel={handleCloseModal}
        footer={[
          <Button key="cancel" onClick={handleCloseModal} disabled={uploading}>
            Huỷ
          </Button>,
          <Button key="submit" type="primary" loading={uploading} onClick={handleUpload}>
            Tải lên
          </Button>,
        ]}
        destroyOnHidden
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
            File đã chọn
            <Input
              value={selectedFile?.name ?? ''}
              readOnly
              style={{ marginTop: 6, fontFamily: 'var(--font-mono)' }}
            />
            {selectedFile && (
              <div style={{ marginTop: 4, color: 'var(--color-muted)', fontSize: 11, fontWeight: 400 }}>
                {(getEvidenceContentType(selectedFile) ?? selectedFile.type) || 'unknown'} · {formatFileSize(selectedFile.size)}
              </div>
            )}
          </label>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
            Loại bằng chứng
            <div style={{ marginTop: 6, display: 'flex', gap: 12 }}>
              {(['image', 'video', 'document'] as EvidenceFileType[]).map((t) => (
                <label
                  key={t}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    cursor: uploading ? 'not-allowed' : 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="evidence-file-type"
                    value={t}
                    checked={fileType === t}
                    disabled={uploading}
                    onChange={() => setFileType(t)}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  {t === 'image' ? 'Ảnh' : t === 'video' ? 'Video' : 'Tài liệu'}
                </label>
              ))}
            </div>
          </label>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
            Mô tả (không bắt buộc)
            <Input.TextArea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả ngắn về bằng chứng"
              maxLength={300}
              style={{ marginTop: 6, fontFamily: 'var(--font-mono)', resize: 'none' }}
              disabled={uploading}
            />
          </label>
        </div>
      </Modal>
    </div>
  )
}
