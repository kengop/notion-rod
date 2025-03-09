#!/bin/sh

# SIGTERM などを受け取ったときにも .env を削除する
trap 'rm -f .env' EXIT

# .env を作成
echo "$ENV_FILE" >.env

# アプリを起動
exec "$@"
