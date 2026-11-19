import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = structlog.get_logger()


class AppError(Exception):
    """Erreur métier : code HTTP + message lisible, sans détails internes.

    Corps JSON : {"code", "message"} à la racine (le front lit `message` à cet endroit)."""

    def __init__(self, message: str, status_code: int = 400, code: str = "bad_request"):
        self.message = message
        self.status_code = status_code
        self.code = code


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"code": exc.code, "message": exc.message},
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        # Messages en français (le front affiche `message` tel quel).
        message = {404: "Ressource introuvable.", 405: "Méthode non autorisée."}.get(
            exc.status_code, "Requête refusée."
        )
        return JSONResponse(status_code=exc.status_code, content={"message": message})

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.error("unhandled_error", error=repr(exc))
        return JSONResponse(
            status_code=500,
            content={"code": "internal_error", "message": "Erreur interne."},
        )
