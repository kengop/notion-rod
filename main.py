from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def read_root():
    return {"message": "Hello, Fast API"}


@app.get("/item/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}


@app.post("/notion/")
async def post_notion(json_data: dict):
    print(json_data)
    return {}
