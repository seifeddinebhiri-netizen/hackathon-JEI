from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings
from app.middleware.request_id import RequestContextMiddleware


def register_middleware(app: FastAPI, settings: Settings) -> None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[
            "X-Request-ID",
            "Content-Disposition",
            "X-C2PA-Manifest-Id",
            "X-C2PA-Simulated",
            "X-Signed-At",
        ],
    )
    app.add_middleware(RequestContextMiddleware)
