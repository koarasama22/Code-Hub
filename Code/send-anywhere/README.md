# Send Anywhere クローン

## プロジェクト概要
- **名前**: Send Anywhere Clone (webapp)
- **目的**: [Send Anywhere](https://send-anywhere.com/ja/) のように、6桁キーだけでファイルを送受信できる会員登録不要のファイル転送サービス
- **主な機能**:
  - 複数ファイルのドラッグ&ドロップ / 選択アップロード (進捗バー付き)
  - 6桁キーの自動発行 (10分間有効・クリックでコピー)
  - 共有リンク + QRコード (48時間有効)
  - 受信側: 6桁キー入力 (自動フォーカス移動・ペースト対応) でファイル一覧表示、個別/一括ダウンロード
  - 送信側: ダウンロード回数のリアルタイム表示、転送の削除 (キャンセル)
  - 期限切れデータの自動クリーンアップ (リクエスト時に遅延実行)

## URL
- **サンドボックス (開発)**: https://3000-i3tjna1cazrb7oroyj0gq-82b888ba.sandbox.novita.ai
- **本番**: 未デプロイ

## API エンドポイント
| メソッド | パス | 説明 |
|---|---|---|
| POST | `/api/transfers` | 転送作成。body: `{files:[{name,size,mime}]}` → `{id,key,uploadToken,files[]}` |
| PUT | `/api/transfers/:id/files/:fileId` | ファイル本体アップロード (ヘッダ `x-upload-token` 必須) |
| GET | `/api/transfers/:id/status` | 送信者向け状態取得 (`x-upload-token` 必須) |
| DELETE | `/api/transfers/:id` | 転送削除 (`x-upload-token` 必須) |
| GET | `/api/receive/:key` | 6桁キーで転送を検索 (ready のみ) |
| GET | `/api/transfers/:id` | 転送IDで情報取得 (共有リンク用) |
| GET | `/api/transfers/:id/files/:fileId/download` | ファイルダウンロード |
| GET | `/` , `/r/:id` | フロントエンド (`/r/:id` は共有リンク) |

## データアーキテクチャ
- **ストレージ**:
  - **Cloudflare R2** (`R2` binding / bucket `webapp-files`): ファイル本体 (`{transferId}/{fileId}`)
  - **Cloudflare D1** (`DB` binding / `webapp-production`): メタデータ
- **テーブル**:
  - `transfers`: id, key6, upload_token, status(uploading/ready), file_count, total_size, download_count, created_at, key_expires_at, expires_at
  - `files`: id, transfer_id, name, size, mime, r2_key, uploaded
- **データフロー**: 転送作成(D1) → 各ファイル PUT(R2 + D1更新) → 全完了で `ready` → 受信側がキー/リンクで検索 → R2からストリーミング配信

## 制限値 (src/index.tsx の定数)
- キー有効期限: 10分 / ファイル保存: 48時間
- 1ファイル上限: 90MB (Workers のリクエストサイズ制限を考慮) / 最大50ファイル

## 使い方
1. 「送信」カードにファイルをドロップし「送信する」
2. 表示された6桁キー (またはQR/リンク) を相手に伝える
3. 相手は「受信」カードにキーを入力して「受信する」→ ダウンロード

## 開発
```bash
npm run build
npx wrangler d1 migrations apply webapp-production --local
pm2 start ecosystem.config.cjs
curl http://localhost:3000
```

## 未実装 / 今後の候補
- ZIP一括ダウンロード (現状はファイルごとに順次ダウンロード)
- 90MB超ファイル対応 (R2 マルチパートアップロード)
- 送信履歴 / 端末間の直接転送 (WebRTC)
- 本番デプロイ (D1 `database_id` の差し替え・R2 バケット作成が必要)

## デプロイ
- **プラットフォーム**: Cloudflare Pages (Hono + R2 + D1)
- **状態**: 開発サンドボックスで稼働中 / 本番未デプロイ
- **技術スタック**: Hono + TypeScript + TailwindCSS (CDN) + axios + qrcodejs
- **最終更新**: 2026-11-05
