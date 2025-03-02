import json
import logging
import os
from typing import List
import typing
from fastapi import FastAPI, Request, status
from typing import NamedTuple
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from src.notion import create_request, post_request


import uvicorn.config
import uvicorn.server

app = FastAPI()

logger = logging.getLogger("uvicorn.error")
logger.setLevel(logging.DEBUG)


@app.get("/")
def read_root():
    return {"message": "Hello, Fast API"}


@app.get("/item/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}


@app.post("/notion/")
async def post_notion(json_data: dict[typing.Any, typing.Any]):
    print(json_data)
    return {}


class WebhookItemIdObject(NamedTuple):
    id: str


class WebhookItemMessage(BaseModel):
    mid: str
    text: str


class WebhookItemValue(BaseModel):
    sender: WebhookItemIdObject
    recipient: WebhookItemIdObject
    timestamp: int
    message: WebhookItemMessage


class WebhookItemChange(BaseModel):
    field: str
    value: WebhookItemValue


class WebhookItemEntry(BaseModel):
    id: str
    time: int
    changes: List[WebhookItemChange] | None = None
    messaging: List[WebhookItemValue] | None = None


class WebhookPost(BaseModel):
    entry: List[WebhookItemEntry]
    object: str


@app.post(
    "/webhook/",
)
async def instagram_webhook(item: WebhookPost):
    logger.debug(item)
    if item.entry is not None:
        for entry in item.entry:
            if entry.changes is not None:
                for change in entry.changes:
                    if change.field == "messages":
                        value = change.value
                        sender_id = value.sender.id
                        message_text = value.message.text
                        req = create_request(sender_id, message_text)
                        res = post_request(req)
                        logger.debug(json.loads(res.data))
                        return "OK", 200
            if entry.messaging is not None:
                for m in entry.messaging:
                    sender_id = m.sender.id
                    message_text = m.message.text
                    req = create_request(sender_id, message_text)
                    res = post_request(req)
                    logger.debug(json.loads(res.data))
                    return "OK", 200
    return "No Data", 400


# Webhookの認証用（Meta Webhooksの検証用）
@app.get("/webhook/")
async def verify_webhook(request: Request):
    VERIFY_TOKEN = os.getenv("INSTAGRAM_API_VERIFY_TOKEN")
    if request.query_params["hub.verify_token"] == VERIFY_TOKEN:
        return int(request.query_params["hub.challenge"])
    return "Invalid verification token", 403


@app.exception_handler(RequestValidationError)
async def handler(request: Request, exc: RequestValidationError):
    logger.debug(exc)
    return JSONResponse(content={}, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)


if __name__ == "__main__":
    import uvicorn

    logger.info("Starting Uvicorn server...")
    uvicorn.run(
        "main:app",
        port=5000,
        reload=True,
        log_level="debug",
    )
