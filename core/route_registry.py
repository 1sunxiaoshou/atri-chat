"""FastAPI route registration for startup phases."""

from __future__ import annotations

import importlib

from fastapi import FastAPI

from core.startup_metrics import startup_metrics

RouteSpec = tuple[str, str, list[str]]


CRITICAL_ROUTE_SPECS: list[RouteSpec] = [
    ("health", "/api/v1", ["health"]),
    ("runtime", "/api/v1", ["runtime"]),
    ("tts", "/api/v1/tts", ["tts"]),
    ("characters", "/api/v1", ["characters"]),
    ("conversations", "/api/v1", ["conversations"]),
    ("agent_stream", "/api/v1", ["messages"]),
    ("models", "/api/v1", ["models"]),
    ("providers", "/api/v1", ["providers"]),
    ("asr", "/api/v1/asr", ["asr"]),
]


DEFERRED_ROUTE_SPECS: list[RouteSpec] = [
    ("avatars", "/api/v1", ["assets"]),
    ("motions", "/api/v1", ["assets"]),
    ("tts_providers", "/api/v1", ["tts"]),
    ("voice_assets", "/api/v1", ["tts"]),
    ("character_motion_bindings_v2", "/api/v1", ["characters"]),
    ("asr_mgmt", "/api/v1/asr/mgmt", ["asr-mgmt"]),
    ("upload", "/api", ["upload"]),
]


def register_routes(
    target_app: FastAPI, route_specs: list[RouteSpec], state_flag: str
) -> None:
    """Import and register routes for a startup phase."""
    if getattr(target_app.state, state_flag, False):
        return

    for module_name, prefix, tags in route_specs:
        module = importlib.import_module(f"api.routes.{module_name}")
        target_app.include_router(module.router, prefix=prefix, tags=tags)

    setattr(target_app.state, state_flag, True)
    if state_flag == "critical_routes_registered":
        startup_metrics.mark("routes_registered")
    else:
        startup_metrics.mark("background_routes_registered")
