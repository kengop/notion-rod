import axios from "axios";
import { config } from "dotenv";

// 環境変数を読み込む
config();

// 型定義
interface InstagramMessage {
  mid: string;
  text: string;
}

interface InstagramSender {
  id: string;
  username?: string;
  name?: string;
}

interface InstagramWebhookValue {
  sender: InstagramSender;
  recipient: { id: string };
  timestamp: number;
  message: InstagramMessage;
}

interface InstagramWebhookChange {
  field: string;
  value: InstagramWebhookValue;
}

interface InstagramWebhookEntry {
  id: string;
  time: number;
  changes?: InstagramWebhookChange[];
  messaging?: InstagramWebhookValue[];
}

interface InstagramWebhookPayload {
  entry: InstagramWebhookEntry[];
  object: string;
}

interface NotionPageProperties {
  [key: string]: any;
}

interface NotionPageRequest {
  parent: { database_id: string };
  icon?: { emoji: string };
  properties: NotionPageProperties;
}

// Instagram APIからユーザー情報を取得する関数
async function getInstagramUserInfo(userId: string): Promise<InstagramSender> {
  try {
    // 実際のアプリではInstagram Graph APIを使用してユーザー情報を取得する
    // ここではダミーのリクエストを示す
    const response = await axios.get(`https://graph.instagram.com/${userId}`, {
      params: {
        fields: "username,name",
        access_token: process.env.INSTAGRAM_ACCESS_TOKEN,
      },
    });

    return {
      id: userId,
      username: response.data.username,
      name: response.data.name,
    };
  } catch (error) {
    console.error("Failed to get Instagram user info:", error);
    // エラーが発生した場合はIDのみを返す
    return { id: userId };
  }
}

// Notionにページを作成する関数
async function createNotionPage(
  title: string,
  description: string
): Promise<any> {
  try {
    const notionApiKey = process.env.NOTION_API_KEY;
    const databaseId = process.env.DATABASE_ID;

    if (!notionApiKey || !databaseId) {
      throw new Error("Notion API key or Database ID is missing");
    }

    const pageRequest: NotionPageRequest = {
      parent: { database_id: databaseId },
      icon: { emoji: "😀" },
      properties: {
        名前: { title: [{ text: { content: title } }] },
        Description: { rich_text: [{ text: { content: description } }] },
      },
    };

    const response = await axios.post(
      "https://api.notion.com/v1/pages",
      pageRequest,
      {
        headers: {
          Authorization: `Bearer ${notionApiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Failed to create Notion page:", error);
    throw error;
  }
}

// InstagramのWebhookペイロードを処理する関数
export async function processInstagramWebhook(
  payload: InstagramWebhookPayload
): Promise<string> {
  try {
    for (const entry of payload.entry) {
      // changesフィールドの処理
      if (entry.changes) {
        for (const change of entry.changes) {
          if (change.field === "messages") {
            const value = change.value;
            const senderId = value.sender.id;
            const messageText = value.message.text;

            // Instagram APIからユーザー情報を取得
            const userInfo = await getInstagramUserInfo(senderId);

            // ユーザー名がない場合はIDを使用
            const senderName = userInfo.name || userInfo.username || senderId;

            // Notionページのタイトルを作成
            const pageTitle = `${senderName}に返信する`;

            // Notionにページを作成
            await createNotionPage(pageTitle, messageText);

            return "Success";
          }
        }
      }

      // messagingフィールドの処理
      if (entry.messaging) {
        for (const message of entry.messaging) {
          const senderId = message.sender.id;
          const messageText = message.message.text;

          // Instagram APIからユーザー情報を取得
          const userInfo = await getInstagramUserInfo(senderId);

          // ユーザー名がない場合はIDを使用
          const senderName = userInfo.name || userInfo.username || senderId;

          // Notionページのタイトルを作成
          const pageTitle = `${senderName}に返信する`;

          // Notionにページを作成
          await createNotionPage(pageTitle, messageText);

          return "Success";
        }
      }
    }

    return "No messages found";
  } catch (error) {
    console.error("Error processing Instagram webhook:", error);
    throw error;
  }
}
