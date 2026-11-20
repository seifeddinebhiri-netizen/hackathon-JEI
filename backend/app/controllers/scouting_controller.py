from fastapi import Request

from app.services.scouting_service import ScoutingService


def scouting_service(request: Request) -> ScoutingService:
    service = request.app.state.scouting
    service.check_rate(request.client.host if request.client else "local")
    return service
