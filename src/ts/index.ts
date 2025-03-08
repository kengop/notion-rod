import express from "express";
import bodyParser from "body-parser";
import { config } from "dotenv";
import { processInstagramWebhook } from "./instagram-notion";

// 環境変数を読み込む
config();

const app = express();
const PORT = process.env.PORT || 3000;

// JSONリクエストのパース
app.use(bodyParser.json());

// ルートエンドポイント
app.get("/", (req, res) => {
  res.send("Instagram to Notion Integration Server");
});

// Webhookの検証エンドポイント
app.get("/webhook", (req, res) => {
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
app.post("/webhook", async (req, res) => {
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
