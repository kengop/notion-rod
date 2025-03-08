import { processInstagramWebhook } from "./instagram-notion";
import axios from "axios";
import { jest } from "@jest/globals";

// axiosをモック化
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// テスト用のモックデータ
const mockWebhookPayload = {
  entry: [
    {
      id: "123456789",
      time: 1635867954,
      changes: [
        {
          field: "messages",
          value: {
            sender: {
              id: "987654321",
            },
            recipient: {
              id: "123456789",
            },
            timestamp: 1635867954,
            message: {
              mid: "mid.123456789",
              text: "こんにちは！商品について質問があります。",
            },
          },
        },
      ],
    },
  ],
  object: "instagram",
};

// Instagram APIのレスポンスをモック
const mockInstagramResponse = {
  data: {
    id: "987654321",
    username: "test_user",
    name: "テストユーザー",
  },
};

// Notion APIのレスポンスをモック
const mockNotionResponse = {
  data: {
    id: "notion-page-id",
    url: "https://notion.so/page-id",
  },
};

// モック関数を使用してaxiosの動作をオーバーライド
function setupMocks() {
  // axiosのgetメソッドをモック
  mockedAxios.get.mockResolvedValue(mockInstagramResponse);

  // axiosのpostメソッドをモック
  mockedAxios.post.mockResolvedValue(mockNotionResponse);

  // 環境変数のモック
  process.env.NOTION_API_KEY = "test-notion-api-key";
  process.env.DATABASE_ID = "test-database-id";
  process.env.INSTAGRAM_ACCESS_TOKEN = "test-instagram-token";
}

// テストケース
describe("Instagram Webhook Processing", () => {
  beforeEach(() => {
    // 各テスト前にモックをセットアップ
    setupMocks();
  });

  afterEach(() => {
    // 各テスト後にモックをリセット
    jest.resetAllMocks();
  });

  test("正常系: メッセージを受信してNotionページを作成", async () => {
    // 期待される結果
    const expectedResult = "Success";

    // テスト実行
    const result = await processInstagramWebhook(mockWebhookPayload);

    // アサーション
    expect(result).toBe(expectedResult);

    // Instagram APIが正しく呼び出されたか検証
    expect(mockedAxios.get).toHaveBeenCalledWith(
      "https://graph.instagram.com/987654321",
      expect.objectContaining({
        params: expect.objectContaining({
          fields: "username,name",
          access_token: "test-instagram-token",
        }),
      })
    );

    // Notion APIが正しく呼び出されたか検証
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://api.notion.com/v1/pages",
      expect.objectContaining({
        parent: { database_id: "test-database-id" },
        properties: expect.objectContaining({
          名前: { title: [{ text: { content: "テストユーザーに返信する" } }] },
          Description: {
            rich_text: [
              { text: { content: "こんにちは！商品について質問があります。" } },
            ],
          },
        }),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-notion-api-key",
          "Notion-Version": "2022-06-28",
        }),
      })
    );
  });

  test("異常系: メッセージが見つからない場合", async () => {
    // メッセージがないペイロード
    const emptyPayload = {
      entry: [{ id: "123", time: 123456789 }],
      object: "instagram",
    };

    // 期待される結果
    const expectedResult = "No messages found";

    // テスト実行
    const result = await processInstagramWebhook(emptyPayload);

    // アサーション
    expect(result).toBe(expectedResult);

    // APIが呼び出されていないことを検証
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  test("異常系: Instagram APIがエラーを返す場合", async () => {
    // Instagram APIのエラーをモック
    mockedAxios.get.mockRejectedValueOnce(new Error("API Error"));

    // テスト実行
    const result = await processInstagramWebhook(mockWebhookPayload);

    // アサーション - IDをフォールバックとして使用
    expect(result).toBe("Success");

    // Notion APIが正しく呼び出されたか検証（ユーザー名の代わりにIDを使用）
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://api.notion.com/v1/pages",
      expect.objectContaining({
        properties: expect.objectContaining({
          名前: { title: [{ text: { content: "987654321に返信する" } }] },
        }),
      }),
      expect.any(Object)
    );
  });
});
