import json
import os

import urllib3
from typing import NamedTuple


api_url = "https://api.notion.com/v1/pages"


class EnvSettings(NamedTuple):
    notion_api_key: str
    database_id: str


def initEnv():
    notion_api_key = os.getenv("NOTION_API_KEY")
    database_id = os.getenv("DATABASE_ID")
    if notion_api_key is None:
        raise ValueError
    if database_id is None:
        raise ValueError
    return EnvSettings(notion_api_key, database_id)


class RequestNotionPage(NamedTuple):
    http: urllib3.PoolManager
    params: dict


def post_request_core(reqNotion: RequestNotionPage):
    """
    notion APIのpagesエンドポイント向きのPOSTリクエスト
    """
    headers = {
        "Authorization": "Bearer " + env_settings.notion_api_key,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }
    encoded_data = json.dumps(reqNotion.params).encode("utf-8")
    return reqNotion.http.request("POST", api_url, body=encoded_data, headers=headers)


def post_request(req: RequestNotionPage):
    res = post_request_core(req)
    return res


def create_request(page_title: str, description: str):
    http = urllib3.PoolManager()
    params = {
        "parent": {"database_id": env_settings.database_id},
        "icon": {"emoji": "😀"},
        "properties": {
            "名前": {"title": [{"text": {"content": page_title}}]},
            "Description": {"rich_text": [{"text": {"content": description}}]},
        },
    }
    return RequestNotionPage(http, params)


env_settings = initEnv()
