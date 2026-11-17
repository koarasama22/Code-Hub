import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { renderer } from './renderer'
import { Home } from './page'

type Bindings = {
  DB: D1Database
  R2: R2Bucket
}

const app = new Hono<{ Bindings: Bindings }>()

// ---- 定数 ----
const KEY_TTL_MS = 10 * 60 * 1000            // 6桁キーの有効期限: 10分
const FILE_TTL_MS = 12 * 60 * 60 * 1000      // ファイル保存期間: 12時間
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024 // 1ファイルの上限: 2GB (分割アップロード)
const MAX_TOTAL_SIZE = 5 * 1024 * 1024 * 1024 // 1転送の合計上限: 5GB
const MAX_FILES = 100
const SINGLE_PUT_LIMIT = 8 * 1024 * 1024     // これ以下は1リクエストで送信
const CHUNK_SIZE = 8 * 1024 * 1024           // 分割アップロードのチャンクサイズ (R2の最小5MB以上)

app.use('/api/*', cors())

// ---- ユーティリティ ----
const uid = () => crypto.randomUUID().replace(/-/g, '')

const genKey6 = () => {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return String(arr[0] % 1000000).padStart(6, '0')
}

const now = () => Date.now()

type TransferRow = {
  id: string; key6: string; upload_token: string; status: string
  file_count: number; total_size: number; download_count: number
  created_at: number; key_expires_at: number; expires_at: number
}
type FileRow = {
  id: string; transfer_id: string; name: string; size: number
  mime: string; r2_key: string; uploaded: number
  upload_id: string | null; part_count: number; uploaded_bytes: number
}

// 期限切れ転送の遅延クリーンアップ(リクエスト時に実行)
async function cleanupExpired(env: Bindings) {
  try {
    const t = now()
    const { results } = await env.DB.prepare(
      'SELECT id FROM transfers WHERE expires_at < ? LIMIT 20'
    ).bind(t).all<{ id: string }>()
    if (!results?.length) return
    for (const tr of results) {
      const files = await env.DB.prepare('SELECT r2_key FROM files WHERE transfer_id = ?')
        .bind(tr.id).all<{ r2_key: string }>()
      for (const f of files.results ?? []) {
        await env.R2.delete(f.r2_key)
      }
      await env.DB.prepare('DELETE FROM files WHERE transfer_id = ?').bind(tr.id).run()
      await env.DB.prepare('DELETE FROM transfers WHERE id = ?').bind(tr.id).run()
    }
  } catch (e) {
    console.error('cleanup error', e)
  }
}

function publicTransfer(tr: TransferRow, files: FileRow[]) {
  return {
    id: tr.id,
    key: tr.key6,
    status: tr.status,
    fileCount: tr.file_count,
    totalSize: tr.total_size,
    downloadCount: tr.download_count,
    createdAt: tr.created_at,
    keyExpiresAt: tr.key_expires_at,
    expiresAt: tr.expires_at,
    files: files.map(f => ({ id: f.id, name: f.name, size: f.size, mime: f.mime }))
  }
}

// ---- API ----

// 転送セッション作成: ファイル一覧を登録して6桁キー発行
app.post('/api/transfers', async (c) => {
  const { env } = c
  await cleanupExpired(env)

  const body = await c.req.json<{ files: { name: string; size: number; mime?: string }[] }>().catch(() => null)
  if (!body || !Array.isArray(body.files) || body.files.length === 0) {
    return c.json({ error: 'ファイルが指定されていません' }, 400)
  }
  if (body.files.length > MAX_FILES) {
    return c.json({ error: `一度に送れるファイルは${MAX_FILES}個までです` }, 400)
  }
  for (const f of body.files) {
    if (!f.name || typeof f.size !== 'number' || f.size < 0) {
      return c.json({ error: '不正なファイル情報です' }, 400)
    }
    if (f.size > MAX_FILE_SIZE) {
      return c.json({ error: `「${f.name}」はサイズ上限(${MAX_FILE_SIZE / 1024 / 1024 / 1024}GB)を超えています` }, 400)
    }
  }
  const sumSize = body.files.reduce((s, f) => s + f.size, 0)
  if (sumSize > MAX_TOTAL_SIZE) {
    return c.json({ error: `合計サイズが上限(${MAX_TOTAL_SIZE / 1024 / 1024 / 1024}GB)を超えています` }, 400)
  }

  // 衝突しないキーを生成
  let key6 = genKey6()
  for (let i = 0; i < 10; i++) {
    const dup = await env.DB.prepare(
      'SELECT id FROM transfers WHERE key6 = ? AND key_expires_at > ?'
    ).bind(key6, now()).first()
    if (!dup) break
    key6 = genKey6()
  }

  const id = uid()
  const token = uid() + uid()
  const t = now()
  const totalSize = body.files.reduce((s, f) => s + f.size, 0)

  await env.DB.prepare(`
    INSERT INTO transfers (id, key6, upload_token, status, file_count, total_size, download_count, created_at, key_expires_at, expires_at)
    VALUES (?, ?, ?, 'uploading', ?, ?, 0, ?, ?, ?)
  `).bind(id, key6, token, body.files.length, totalSize, t, t + KEY_TTL_MS, t + FILE_TTL_MS).run()

  const fileRows: { id: string; name: string; size: number }[] = []
  const stmts = body.files.map(f => {
    const fid = uid()
    fileRows.push({ id: fid, name: f.name, size: f.size })
    return env.DB.prepare(
      'INSERT INTO files (id, transfer_id, name, size, mime, r2_key, uploaded) VALUES (?, ?, ?, ?, ?, ?, 0)'
    ).bind(fid, id, f.name, f.size, f.mime || 'application/octet-stream', `${id}/${fid}`)
  })
  await env.DB.batch(stmts)

  return c.json({
    id, key: key6, uploadToken: token,
    keyExpiresAt: t + KEY_TTL_MS, expiresAt: t + FILE_TTL_MS,
    files: fileRows
  })
})

// 認証ヘルパー
async function loadFileForUpload(env: Bindings, id: string, fileId: string, token: string | undefined) {
  const tr = await env.DB.prepare('SELECT * FROM transfers WHERE id = ?').bind(id).first<TransferRow>()
  if (!tr) return { error: '転送が見つかりません', status: 404 as const }
  if (tr.upload_token !== token) return { error: '認証エラー', status: 403 as const }
  const file = await env.DB.prepare('SELECT * FROM files WHERE id = ? AND transfer_id = ?')
    .bind(fileId, id).first<FileRow>()
  if (!file) return { error: 'ファイルが見つかりません', status: 404 as const }
  return { tr, file }
}

// 全ファイル完了チェック → ready
async function markReadyIfDone(env: Bindings, transferId: string) {
  const pending = await env.DB.prepare(
    'SELECT COUNT(*) as n FROM files WHERE transfer_id = ? AND uploaded = 0'
  ).bind(transferId).first<{ n: number }>()
  if (pending && pending.n === 0) {
    await env.DB.prepare("UPDATE transfers SET status = 'ready' WHERE id = ?").bind(transferId).run()
  }
  return pending?.n ?? 0
}

// --- 小さいファイル: 単発 PUT ---
app.put('/api/transfers/:id/files/:fileId', async (c) => {
  const { env } = c
  const { id, fileId } = c.req.param()
  const r = await loadFileForUpload(env, id, fileId, c.req.header('x-upload-token'))
  if ('error' in r) return c.json({ error: r.error }, r.status)
  const { file } = r

  const body = c.req.raw.body
  if (!body) return c.json({ error: '本文が空です' }, 400)

  await env.R2.put(file.r2_key, body, {
    httpMetadata: { contentType: file.mime },
    customMetadata: { name: file.name }
  })

  await env.DB.prepare('UPDATE files SET uploaded = 1, uploaded_bytes = ? WHERE id = ?')
    .bind(file.size, fileId).run()
  const remaining = await markReadyIfDone(env, id)
  return c.json({ ok: true, remaining })
})

// --- 大きいファイル: 分割アップロード開始 ---
app.post('/api/transfers/:id/files/:fileId/multipart', async (c) => {
  const { env } = c
  const { id, fileId } = c.req.param()
  const r = await loadFileForUpload(env, id, fileId, c.req.header('x-upload-token'))
  if ('error' in r) return c.json({ error: r.error }, r.status)
  const { file } = r

  const mpu = await env.R2.createMultipartUpload(file.r2_key, {
    httpMetadata: { contentType: file.mime },
    customMetadata: { name: file.name }
  })

  await env.DB.prepare('UPDATE files SET upload_id = ? WHERE id = ?').bind(mpu.uploadId, fileId).run()
  await env.DB.prepare('DELETE FROM parts WHERE file_id = ?').bind(fileId).run()

  const partCount = Math.max(1, Math.ceil(file.size / CHUNK_SIZE))
  return c.json({ uploadId: mpu.uploadId, chunkSize: CHUNK_SIZE, partCount })
})

// --- 大きいファイル: パート送信 ---
app.put('/api/transfers/:id/files/:fileId/parts/:partNumber', async (c) => {
  const { env } = c
  const { id, fileId, partNumber } = c.req.param()
  const r = await loadFileForUpload(env, id, fileId, c.req.header('x-upload-token'))
  if ('error' in r) return c.json({ error: r.error }, r.status)
  const { file } = r

  if (!file.upload_id) return c.json({ error: '分割アップロードが開始されていません' }, 400)
  const pn = Number(partNumber)
  if (!Number.isInteger(pn) || pn < 1 || pn > 10000) return c.json({ error: '不正なパート番号です' }, 400)

  const body = c.req.raw.body
  if (!body) return c.json({ error: '本文が空です' }, 400)

  const mpu = env.R2.resumeMultipartUpload(file.r2_key, file.upload_id)
  let part
  try {
    part = await mpu.uploadPart(pn, body)
  } catch (e) {
    return c.json({ error: `パート送信に失敗しました: ${(e as Error).message}` }, 500)
  }

  const uploadedDelta = Number(c.req.header('content-length') || 0)
  await env.DB.prepare(`
    INSERT INTO parts (file_id, part_number, etag) VALUES (?, ?, ?)
    ON CONFLICT(file_id, part_number) DO UPDATE SET etag = excluded.etag
  `).bind(fileId, pn, part.etag).run()
  await env.DB.prepare('UPDATE files SET uploaded_bytes = uploaded_bytes + ? WHERE id = ?')
    .bind(uploadedDelta, fileId).run()

  return c.json({ ok: true, partNumber: pn, etag: part.etag })
})

// --- 大きいファイル: 分割アップロード完了 ---
app.post('/api/transfers/:id/files/:fileId/complete', async (c) => {
  const { env } = c
  const { id, fileId } = c.req.param()
  const r = await loadFileForUpload(env, id, fileId, c.req.header('x-upload-token'))
  if ('error' in r) return c.json({ error: r.error }, r.status)
  const { file } = r

  if (!file.upload_id) return c.json({ error: '分割アップロードが開始されていません' }, 400)

  const { results } = await env.DB.prepare(
    'SELECT part_number, etag FROM parts WHERE file_id = ? ORDER BY part_number ASC'
  ).bind(fileId).all<{ part_number: number; etag: string }>()

  const parts = (results ?? []).map(p => ({ partNumber: p.part_number, etag: p.etag }))
  if (parts.length === 0) return c.json({ error: 'パートが送信されていません' }, 400)

  const mpu = env.R2.resumeMultipartUpload(file.r2_key, file.upload_id)
  try {
    await mpu.complete(parts)
  } catch (e) {
    return c.json({ error: `結合に失敗しました: ${(e as Error).message}` }, 500)
  }

  await env.DB.prepare('DELETE FROM parts WHERE file_id = ?').bind(fileId).run()
  await env.DB.prepare('UPDATE files SET uploaded = 1, uploaded_bytes = ? WHERE id = ?')
    .bind(file.size, fileId).run()
  const remaining = await markReadyIfDone(env, id)
  return c.json({ ok: true, remaining })
})

// --- 分割アップロード中断 ---
app.delete('/api/transfers/:id/files/:fileId/multipart', async (c) => {
  const { env } = c
  const { id, fileId } = c.req.param()
  const r = await loadFileForUpload(env, id, fileId, c.req.header('x-upload-token'))
  if ('error' in r) return c.json({ error: r.error }, r.status)
  const { file } = r
  if (file.upload_id) {
    try {
      await env.R2.resumeMultipartUpload(file.r2_key, file.upload_id).abort()
    } catch { /* already gone */ }
  }
  await env.DB.prepare('DELETE FROM parts WHERE file_id = ?').bind(fileId).run()
  await env.DB.prepare('UPDATE files SET upload_id = NULL WHERE id = ?').bind(fileId).run()
  return c.json({ ok: true })
})

// 送信者向け: 転送状態確認(ダウンロード数など)
app.get('/api/transfers/:id/status', async (c) => {
  const { env } = c
  const id = c.req.param('id')
  const token = c.req.header('x-upload-token')
  const tr = await env.DB.prepare('SELECT * FROM transfers WHERE id = ?').bind(id).first<TransferRow>()
  if (!tr) return c.json({ error: '転送が見つかりません' }, 404)
  if (tr.upload_token !== token) return c.json({ error: '認証エラー' }, 403)
  const files = await env.DB.prepare('SELECT * FROM files WHERE transfer_id = ?').bind(id).all<FileRow>()
  return c.json(publicTransfer(tr, files.results ?? []))
})

// 送信者向け: 転送を削除(キャンセル)
app.delete('/api/transfers/:id', async (c) => {
  const { env } = c
  const id = c.req.param('id')
  const token = c.req.header('x-upload-token')
  const tr = await env.DB.prepare('SELECT * FROM transfers WHERE id = ?').bind(id).first<TransferRow>()
  if (!tr) return c.json({ error: '転送が見つかりません' }, 404)
  if (tr.upload_token !== token) return c.json({ error: '認証エラー' }, 403)
  const files = await env.DB.prepare('SELECT r2_key FROM files WHERE transfer_id = ?').bind(id).all<{ r2_key: string }>()
  for (const f of files.results ?? []) await env.R2.delete(f.r2_key)
  await env.DB.prepare('DELETE FROM files WHERE transfer_id = ?').bind(id).run()
  await env.DB.prepare('DELETE FROM transfers WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

// 受信者向け: 6桁キーで転送を検索
app.get('/api/receive/:key', async (c) => {
  const { env } = c
  await cleanupExpired(env)
  const key = c.req.param('key').replace(/\D/g, '')
  if (key.length !== 6) return c.json({ error: '6桁の数字を入力してください' }, 400)

  const tr = await env.DB.prepare(
    'SELECT * FROM transfers WHERE key6 = ? AND key_expires_at > ? ORDER BY created_at DESC LIMIT 1'
  ).bind(key, now()).first<TransferRow>()
  if (!tr) return c.json({ error: 'キーが見つからないか、有効期限が切れています' }, 404)
  if (tr.status !== 'ready') return c.json({ error: '送信側のアップロードがまだ完了していません。しばらく待ってから再試行してください', status: 'uploading' }, 409)

  const files = await env.DB.prepare('SELECT * FROM files WHERE transfer_id = ?').bind(tr.id).all<FileRow>()
  return c.json(publicTransfer(tr, files.results ?? []))
})

// 受信者向け: 転送IDで情報取得 (リンク共有用)
app.get('/api/transfers/:id', async (c) => {
  const { env } = c
  const id = c.req.param('id')
  const tr = await env.DB.prepare('SELECT * FROM transfers WHERE id = ? AND expires_at > ?')
    .bind(id, now()).first<TransferRow>()
  if (!tr) return c.json({ error: 'リンクが見つからないか、有効期限が切れています' }, 404)
  if (tr.status !== 'ready') return c.json({ error: 'アップロードがまだ完了していません', status: 'uploading' }, 409)
  const files = await env.DB.prepare('SELECT * FROM files WHERE transfer_id = ?').bind(tr.id).all<FileRow>()
  return c.json(publicTransfer(tr, files.results ?? []))
})

// ダウンロード
app.get('/api/transfers/:id/files/:fileId/download', async (c) => {
  const { env } = c
  const { id, fileId } = c.req.param()
  const tr = await env.DB.prepare('SELECT * FROM transfers WHERE id = ? AND expires_at > ?')
    .bind(id, now()).first<TransferRow>()
  if (!tr) return c.text('Not found or expired', 404)
  const file = await env.DB.prepare('SELECT * FROM files WHERE id = ? AND transfer_id = ? AND uploaded = 1')
    .bind(fileId, id).first<FileRow>()
  if (!file) return c.text('File not found', 404)

  const obj = await env.R2.get(file.r2_key)
  if (!obj) return c.text('File not found in storage', 404)

  await env.DB.prepare('UPDATE transfers SET download_count = download_count + 1 WHERE id = ?').bind(id).run()

  const encoded = encodeURIComponent(file.name).replace(/['()]/g, escape).replace(/\*/g, '%2A')
  const headers = new Headers()
  headers.set('Content-Type', file.mime || 'application/octet-stream')
  headers.set('Content-Length', String(file.size))
  headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`)
  headers.set('Cache-Control', 'private, no-store')
  if (obj.httpEtag) headers.set('ETag', obj.httpEtag)
  return new Response(obj.body, { headers })
})

// ---- ページ ----
app.use(renderer)
app.get('/', (c) => c.render(<Home />))
app.get('/r/:id', (c) => c.render(<Home />))

export default app
