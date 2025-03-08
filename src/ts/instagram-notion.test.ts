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
const mockNotionCreateResponse = {
  data: {
    id: "notion-page-id",
    url: "https://notion.so/page-id",
    properties: {
      名前: { title: [{ text: { content: "テストユーザーに返信する" } }] },
      Description: {
        rich_text: [
          { text: { content: "こんにちは！商品について質問があります。" } },
        ],
      },
      状態: { select: { name: "未着手" } },
    },
  },
};

const mockNotionUpdateResponse = {
  data: {
    id: "existing-page-id",
    url: "https://notion.so/existing-page-id",
    properties: {
      名前: { title: [{ text: { content: "テストユーザーに返信する" } }] },
      Description: {
        rich_text: [{ text: { content: "更新されたメッセージ内容" } }],
      },
      状態: { select: { name: "未着手" } },
    },
  },
};

// 検索結果のモック - タスクなし
const mockEmptySearchResponse = {
  data: {
    results: [],
    has_more: false,
    next_cursor: null,
  },
};

// 検索結果のモック - 未着手のタスクあり
const mockExistingTaskSearchResponse = {
  data: {
    results: [
      {
        id: "existing-page-id",
        url: "https://notion.so/existing-page-id",
        properties: {
          名前: { title: [{ text: { content: "テストユーザーに返信する" } }] },
          Description: {
            rich_text: [{ text: { content: "以前のメッセージ内容" } }],
          },
          状態: { select: { name: "未着手" } },
        },
      },
    ],
    has_more: false,
    next_cursor: null,
  },
};

// モック関数を使用してaxiosの動作をオーバーライド
function setupMocks() {
  // axiosのgetメソッドをモック
  mockedAxios.get.mockResolvedValue(mockInstagramResponse);

  // axiosのpostメソッドをモック - デフォルトでは空の検索結果と新規作成レスポンスを返す
  // mockedAxios.post.mockReset(); // この行をコメントアウト
  // 検索APIのモック
  // mockedAxios.post.mockResolvedValueOnce(mockEmptySearchResponse); // この行をコメントアウト
  // 作成APIのモック
  // mockedAxios.post.mockResolvedValueOnce(mockNotionCreateResponse); // この行をコメントアウト

  // axiosのpatchメソッドをモック
  mockedAxios.patch.mockResolvedValue(mockNotionUpdateResponse);

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

  test("正常系: メッセージを受信して新しいNotionページを作成", async () => {
    // 検索結果が空のモックを設定
    mockedAxios.post.mockClear();
    mockedAxios.post.mockResolvedValueOnce(mockEmptySearchResponse); // 検索API - 未着手タスク
    mockedAxios.post.mockResolvedValueOnce(mockEmptySearchResponse); // 検索API - 進行中タスク
    mockedAxios.post.mockResolvedValueOnce(mockNotionCreateResponse); // 作成API

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

    // Notion検索APIが呼び出されたか検証（2回呼ばれる）
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://api.notion.com/v1/search",
      expect.any(Object),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-notion-api-key",
          "Notion-Version": "2022-06-28",
        }),
      })
    );

    // Notion作成APIが正しく呼び出されたか検証
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
          状態: { select: { name: "未着手" } }, // 状態プロパティが追加されていることを確認
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

  test("正常系: 既存のタスクを更新", async () => {
    // 既存のタスクがある場合の検索結果をモック
    mockedAxios.post.mockClear();
    mockedAxios.post.mockResolvedValueOnce(mockExistingTaskSearchResponse); // 検索API - 未着手タスク
    mockedAxios.post.mockResolvedValueOnce(mockEmptySearchResponse); // 検索API - 進行中タスク（空の結果）

    // 期待される結果
    const expectedResult = "Success";

    // テスト実行
    const result = await processInstagramWebhook(mockWebhookPayload);

    // アサーション
    expect(result).toBe(expectedResult);

    // Notion検索APIが呼び出されたか検証
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://api.notion.com/v1/search",
      expect.any(Object),
      expect.any(Object)
    );

    // Notion更新APIが正しく呼び出されたか検証
    expect(mockedAxios.patch).toHaveBeenCalledWith(
      "https://api.notion.com/v1/pages/existing-page-id",
      expect.objectContaining({
        properties: expect.objectContaining({
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

    // 新規作成APIが呼び出されていないことを確認
    expect(mockedAxios.post).not.toHaveBeenCalledWith(
      "https://api.notion.com/v1/pages",
      expect.any(Object),
      expect.any(Object)
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
    expect(mockedAxios.post).not.toHaveBeenCalledWith(
      "https://api.notion.com/v1/pages",
      expect.any(Object),
      expect.any(Object)
    );
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  test("異常系: Instagram APIがエラーを返す場合", async () => {
    // Instagram APIのエラーをモック
    mockedAxios.get.mockRejectedValueOnce(new Error("API Error"));

    // 検索結果が空のモックを設定
    mockedAxios.post.mockClear();
    mockedAxios.post.mockResolvedValueOnce(mockEmptySearchResponse); // 検索API - 未着手タスク
    mockedAxios.post.mockResolvedValueOnce(mockEmptySearchResponse); // 検索API - 進行中タスク
    mockedAxios.post.mockResolvedValueOnce(mockNotionCreateResponse); // 作成API

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
          状態: { select: { name: "未着手" } },
        }),
      }),
      expect.any(Object)
    );
  });

  test("異常系: Notion検索APIがエラーを返す場合", async () => {
    // Notion検索APIのエラーをモック
    mockedAxios.post.mockClear();
    mockedAxios.post.mockRejectedValueOnce(
      new Error("Notion Search API Error")
    ); // 検索APIエラー - 未着手タスク
    mockedAxios.post.mockResolvedValueOnce(mockNotionCreateResponse); // 作成API

    // テスト実行
    const result = await processInstagramWebhook(mockWebhookPayload);

    // アサーション - エラーが発生しても新規作成が行われる
    expect(result).toBe("Success");

    // Notion作成APIが呼び出されたことを確認
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://api.notion.com/v1/pages",
      expect.any(Object),
      expect.any(Object)
    );
  });
});
