import express, { Request, Response } from "express";
import { config } from "dotenv";
import { processInstagramWebhook } from "./instagram-notion";
import { Firestore, FieldValue } from "@google-cloud/firestore";

// GCP Cloud Firestore の初期化（Cloud Run 等 GCP 環境なら自動認証される）
const firestore = new Firestore({ databaseId: "rodcatch" });

// 環境変数を読み込む
config();

// 必須環境変数のチェック
const requiredEnvVars = [
  "NOTION_CLIENT_ID",
  "NOTION_CLIENT_SECRET",
  "NOTION_REDIRECT_URI",
  "INSTAGRAM_API_VERIFY_TOKEN",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: Environment variable ${envVar} is not set`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// JSONリクエストのパース
app.use(express.json());

// ルートエンドポイント
app.get("/", (req: Request, res: Response) => {
  res.send("Instagram to Notion Integration Server");
});

// Notion OAuth 用の設定値
const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID;
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET;
const NOTION_REDIRECT_URI = process.env.NOTION_REDIRECT_URI;

// ----------------------------------------
// GET /auth/notion
// ユーザーを Notion の OAuth 認証画面にリダイレクトするエンドポイント
// ----------------------------------------
app.get("/auth/notion", (req: Request, res: Response) => {
  // 任意の state パラメータを設定することで CSRF 対策やユーザー識別が可能（例：ユーザーIDなど）
  const state = String(req.query.state || "default_state");

  const params = new URLSearchParams({
    client_id: NOTION_CLIENT_ID as string,
    redirect_uri: NOTION_REDIRECT_URI as string,
    response_type: "code",
    owner: "user",
    state: state,
  }).toString();

  const notionAuthUrl = `https://api.notion.com/v1/oauth/authorize?${params}`;
  res.redirect(notionAuthUrl);
});

// -----------------------------
// GET /auth/notion/callback
// Notion OAuth のコールバックエンドポイント
// 認証コードを受け取り、アクセストークンを取得し Firestore に保存する
// -----------------------------
app.get("/auth/notion/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const state = (req.query.state as string) || "default_state";

  if (!code) {
    return res.status(400).send("Missing code parameter");
  }

  try {
    console.log(NOTION_REDIRECT_URI);
    // Notion のトークン交換エンドポイントへ POST リクエストを送信
    // HTTP Basic Authentication で CLIENT_ID:CLIENT_SECRET を送信
    const credentials = Buffer.from(
      `${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`
    ).toString("base64");
    const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: NOTION_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return res.status(500).send("Token exchange failed");
    }

    const tokenData: {
      access_token: string;
      bot_id: string;
      workspace_id: string;
      workspace_name?: string;
      workspace_icon?: string;
      // その他 Notion から返されるフィールドを必要に応じて追加
    } = await tokenResponse.json();

    // ※ここでは state をユーザーIDとして利用しているが、実際は認証済みユーザーのIDと紐づける必要がある
    const userId: string = tokenData.bot_id;

    // Firestore にユーザーの Notion 関連情報を保存
    const userDocRef = firestore.collection("users").doc(userId);
    await userDocRef.set(
      {
        notionBotId: tokenData.bot_id || null,
        notionAccessToken: tokenData.access_token,
        notionWorkspaceId: tokenData.workspace_id || null,
        workspaceName: tokenData.workspace_name || null,
        workspaceIcon: tokenData.workspace_icon || null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.send("Notion OAuth successful and token stored in Firestore!");
  } catch (error) {
    console.error("Error in OAuth callback:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Webhookの検証エンドポイント
app.get("/webhook", (req: Request, res: Response) => {
  const VERIFY_TOKEN = process.env.INSTAGRAM_API_VERIFY_TOKEN;

  // クエリパラメータを取得
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // モードとトークンが存在し、トークンが一致する場合
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    res.status(200).send(challenge);
  } else {
    // 検証失敗
    console.error("Webhook verification failed");
    res.sendStatus(403);
  }
});

// Webhookのデータ受信エンドポイント
app.post("/webhook", async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    // オブジェクトタイプの確認
    if (payload.object === "instagram") {
      console.log("Received Instagram webhook");

      // Webhookデータの処理
      const result = await processInstagramWebhook(payload);
      console.log("Processing result:", result);

      res.status(200).send("EVENT_RECEIVED");
    } else {
      // サポートされていないオブジェクトタイプ
      console.warn(`Unsupported webhook object: ${payload.object}`);
      res.sendStatus(404);
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.sendStatus(500);
  }
});

// サーバーの起動
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
