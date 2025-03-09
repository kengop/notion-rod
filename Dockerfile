# ビルドステージ
FROM node:18-slim AS builder

WORKDIR /app

# 依存関係のインストールに必要なファイルをコピー
COPY package*.json ./

# 開発依存関係を含めてインストール（TypeScriptなどのビルドツールが必要）
RUN npm ci

# ソースコードをコピー
COPY . .

# TypeScriptのビルド
RUN npm run build

# 本番ステージ
FROM node:18-slim

WORKDIR /app

# 依存関係のインストールに必要なファイルをコピー
COPY package*.json ./

# 本番依存関係のみインストール
RUN npm ci --only=production

# ビルドステージからビルド済みのファイルをコピー
COPY --from=builder /app/dist ./dist

# ポート設定（Cloud Runは自動的にPORT環境変数を設定します）
# デフォルトポートを設定しておく（Cloud Run以外の環境で使用する場合のため）
ENV PORT=3000
EXPOSE $PORT

# 環境変数を安全にコンテナ内に展開
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]

# アプリケーションの起動
CMD ["npm", "start"]