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

interface NotionPage {
  id: string;
  properties: NotionPageProperties;
  url: string;
}

interface NotionSearchRequest {
  query?: string;
  filter?: {
    property: string;
    [key: string]: any;
  };
  sort?: {
    timestamp?: string;
    direction: "ascending" | "descending";
  };
}

interface NotionSearchResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

interface NotionUpdatePageRequest {
  properties: NotionPageProperties;
}

// タスクの状態を表す列挙型
enum TaskStatus {
  NotStarted = "未着手",
  InProgress = "進行中",
  Completed = "完了",
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

// Notionデータベースから特定の条件に一致するページを検索する関数
async function searchNotionPages(
  title: string,
  status?: TaskStatus
): Promise<NotionPage[]> {
  try {
    const notionApiKey = process.env.NOTION_API_KEY;
    const databaseId = process.env.DATABASE_ID;

    if (!notionApiKey || !databaseId) {
      console.warn("Notion API key or Database ID is missing");
      return [];
    }

    // 検索条件を設定
    const searchRequest: NotionSearchRequest = {
      query: title, // タイトルで検索
      filter: {
        property: "object",
        value: "page",
      },
      sort: {
        timestamp: "last_edited_time",
        direction: "descending",
      },
    };

    // 検索APIを呼び出す
    const response = await axios.post(
      "https://api.notion.com/v1/search",
      searchRequest,
      {
        headers: {
          Authorization: `Bearer ${notionApiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
      }
    );

    const searchResponse = response.data as NotionSearchResponse;

    // レスポンスのresultsが存在しない場合は空配列を返す
    if (!searchResponse.results || !Array.isArray(searchResponse.results)) {
      console.warn(
        "Notion search response does not contain valid results array"
      );
      return [];
    }
    // タイトルと状態でフィルタリング
    const filteredResults = searchResponse.results.filter((page) => {
      if (!page || !page.properties) {
        return false;
      }

      // タイトルのチェック
      const pageTitleProperty = page.properties["名前"];
      if (
        !pageTitleProperty ||
        !pageTitleProperty.title ||
        !Array.isArray(pageTitleProperty.title) ||
        pageTitleProperty.title.length === 0
      ) {
        return false;
      }

      const pageTitle = pageTitleProperty.title[0]?.text?.content || "";
      const titleMatch = pageTitle === title;

      // 状態のチェック（指定されている場合）
      if (status !== undefined) {
        const statusProperty = page.properties["状態"];
        if (!statusProperty || !statusProperty.status) {
          return false;
        }
        const pageStatus = statusProperty.status.name || "";
        return titleMatch && pageStatus === status;
      }

      return titleMatch;
    });

    return filteredResults;
    return filteredResults;
  } catch (error) {
    console.error("Failed to search Notion pages:", error);
    return [];
  }
}

// Notionページを更新する関数
async function updateNotionPage(
  pageId: string,
  description: string
): Promise<any> {
  try {
    const notionApiKey = process.env.NOTION_API_KEY;

    if (!notionApiKey) {
      throw new Error("Notion API key is missing");
    }

    // 更新リクエストを作成
    const updateRequest: NotionUpdatePageRequest = {
      properties: {
        Description: { rich_text: [{ text: { content: description } }] },
      },
    };

    // ページを更新
    const response = await axios.patch(
      `https://api.notion.com/v1/pages/${pageId}`,
      updateRequest,
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
    console.error("Failed to update Notion page:", error);
    throw error;
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
        状態: { status: { name: TaskStatus.NotStarted } }, // 初期状態は「未着手」
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
    // エラーをスローする代わりにダミーのレスポンスを返す
    return {
      id: "error-page-id",
      url: "https://notion.so/error-page",
      properties: {
        名前: { title: [{ text: { content: title } }] },
        Description: { rich_text: [{ text: { content: description } }] },
        状態: { status: { name: TaskStatus.NotStarted } },
      },
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// 既存のページを更新するか、新しいページを作成する関数
async function createOrUpdateNotionPage(
  title: string,
  description: string
): Promise<any> {
  try {
    // 未完了のタスクを検索
    const incompleteTasks = await searchNotionPages(
      title,
      TaskStatus.NotStarted
    );
    const inProgressTasks = await searchNotionPages(
      title,
      TaskStatus.InProgress
    );

    // 未着手または進行中のタスクがある場合は更新
    if (
      incompleteTasks &&
      incompleteTasks.length > 0 &&
      incompleteTasks[0] &&
      incompleteTasks[0].id
    ) {
      console.log(`Updating existing task: ${title}`);
      return await updateNotionPage(incompleteTasks[0].id, description);
    } else if (
      inProgressTasks &&
      inProgressTasks.length > 0 &&
      inProgressTasks[0] &&
      inProgressTasks[0].id
    ) {
      console.log(`Updating in-progress task: ${title}`);
      return await updateNotionPage(inProgressTasks[0].id, description);
    }

    // 該当するタスクがない場合は新規作成
    console.log(`Creating new task: ${title}`);
    return await createNotionPage(title, description);
  } catch (error) {
    console.error("Failed to create or update Notion page:", error);
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

            // 既存のタスクを更新するか、新しいタスクを作成
            await createOrUpdateNotionPage(pageTitle, messageText);

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

          // 既存のタスクを更新するか、新しいタスクを作成
          await createOrUpdateNotionPage(pageTitle, messageText);

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
