# Notion-rod

このプロジェクトは、InstagramのDMを受信し、Notionデータベースに自動的にページを作成するシステムです。

## 機能

- InstagramのWebhookからDMを受信
- 送信者の名前とメッセージ内容を取得
- Notionデータベースに「(送信者の名前)に返信する」という名前のページを作成

## 技術スタック

- **バックエンド**: 
  - TypeScript (Express)
- **外部API**: 
  - Instagram Graph API
  - Notion API

## セットアップ

### 環境変数

`.env`ファイルに以下の環境変数を設定してください：

```
NOTION_API_KEY=your_notion_api_key
DATABASE_ID=your_notion_database_id
INSTAGRAM_API_VERIFY_TOKEN=your_instagram_webhook_verify_token
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token
PORT=3000
```

### インストール

```bash
# 依存関係のインストール
npm install

# TypeScriptのビルド
npm run build
```

### 実行

```bash
# 開発モード
npm run dev

# 本番モード
npm run start
```

## Webhookの設定

1. Meta Developer Portalでアプリを作成
2. Webhookを設定（URLは `https://your-domain.com/webhook`）
3. 検証トークンを `.env` ファイルの `INSTAGRAM_API_VERIFY_TOKEN` に設定

## テスト

Jestを使用してテストを実行：

```bash
# すべてのテストを実行
npm test

# 特定のテストファイルを実行
npm test -- src/ts/instagram-notion.test.ts

# 監視モードでテストを実行（ファイル変更時に自動的にテストを再実行）
npm test -- --watch
```

## プロジェクト構造

```
notion-rod/
├── dist/                  # コンパイルされたJavaScriptファイル（ビルド後に生成）
├── src/
│   └── ts/                # TypeScriptソースコード
│       ├── index.ts       # メインエントリーポイント
│       ├── instagram-notion.ts # InstagramとNotionの連携ロジック
│       └── instagram-notion.test.ts # Jestテストファイル
├── .clinerules            # Clineの設定ファイル
├── .env                   # 環境変数
├── .gitignore             # Git追跡対象外ファイル
├── jest.config.js         # Jestの設定ファイル
├── package-lock.json      # npm依存関係のロックファイル
├── package.json           # npm設定
├── tsconfig.json          # TypeScript設定
└── README.md              # プロジェクト説明