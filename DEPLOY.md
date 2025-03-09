# Cloud Runデプロイガイド

このガイドでは、notion-rodアプリケーションをGoogle Cloud Runにデプロイする手順を説明します。

## 前提条件

- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)がインストールされていること
- Google Cloudプロジェクトが作成されていること
- Google Cloud CLIで認証が完了していること
- Docker Desktop（ローカルでビルドする場合）

## 1. Google Cloud CLIの設定

```bash
# Google Cloudにログイン
gcloud auth login

# プロジェクトの設定
gcloud config set project notion-rod
```

## 2. 環境変数の準備

Cloud Runサービスに設定する環境変数を準備します。以下の環境変数が必要です：

- `NOTION_API_KEY`: NotionのAPIキー
- `DATABASE_ID`: NotionのデータベースID
- `INSTAGRAM_API_VERIFY_TOKEN`: InstagramのWebhook検証用トークン
- `INSTAGRAM_ACCESS_TOKEN`: InstagramのAPIアクセストークン

**注意**: Cloud Runは自動的に`PORT`環境変数を設定します。アプリケーションはこの環境変数を使用してリッスンポートを決定します。

### 環境変数の設定（初回）

Secret Managerサービスに環境変数：ROD_ENV_FILEを作成します。

```bash
gcloud secrets create ROD_ENV_FILE --replication-policy="automatic"
```

### 環境変数の編集（新しいバージョンのシークレットを作成する）

```bash
gcloud secrets versions add ROD_ENV_FILE --data-file=.env
```

**注意** 新しいバージョンのシークレットを作成すると、Cloud Runにも新しいシークレットを反映させる必要があります。手順は通常のデプロイコマンドに `update-secrets` オプションをつけます。

## 3. Dockerイメージのビルドとデプロイ

### ローカルでビルドしてデプロイ

```bash
# Dockerイメージをビルド
docker build -t asia-docker.pkg.dev/notion-rod/docker-repo/rod-image:latest .

# Google Container Registryにプッシュ
docker push asia-docker.pkg.dev/notion-rod/docker-repo/rod-image:latest

# Cloud Runにデプロイ
gcloud run deploy notion-rod \
  --image=asia-docker.pkg.dev/notion-rod/docker-repo/rod-image:latest \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --update-secrets ENV_FILE=ROD_ENV_FILE:latest
```

## 4. デプロイの確認

デプロイが完了すると、Cloud RunのURLが表示されます。このURLを使用してアプリケーションにアクセスできます。

```
Service [notion-rod] revision [notion-rod-00001-abc] has been deployed and is serving 100 percent of traffic.
Service URL: https://notion-rod-abcdefghij-an.a.run.app
```

## 5. InstagramのWebhook設定の更新

Meta Developer Portalで、WebhookのURLをCloud RunのURLに更新します：

```
https://notion-rod-abcdefghij-an.a.run.app/webhook
```

## トラブルシューティング

### ログの確認

Cloud Runのログを確認するには：

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=notion-rod" --limit 50
```

### 環境変数の更新

デプロイ後に環境変数を更新するには：

```bash
gcloud run services update notion-rod \
  --set-env-vars="NEW_VAR=NEW_VALUE" \
  --update-env-vars="EXISTING_VAR=UPDATED_VALUE"
```

### サービスの削除

不要になったサービスを削除するには：

```bash
gcloud run services delete notion-rod