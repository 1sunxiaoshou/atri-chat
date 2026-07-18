"""FastAPI application bootstrap."""

from __future__ import annotations

import asyncio
import os
import sys
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import AppSettings, get_settings
from core.logger import ensure_file_logging, get_logger, setup_logging
from core.middleware.logging_middleware import LoggingMiddleware
from core.process_guard import watch_parent_process
from core.route_registry import (
    CRITICAL_ROUTE_SPECS,
    DEFERRED_ROUTE_SPECS,
    register_routes,
)
from core.startup_metrics import startup_metrics


def prepare_settings() -> AppSettings:
    """Resolve settings and ensure directories required for app construction."""
    settings = get_settings()
    settings.ensure_directories()
    startup_metrics.mark("settings_ready")
    return settings


def create_app(settings: AppSettings | None = None) -> FastAPI:
    """Create the FastAPI app and attach startup wiring."""
    settings = settings or prepare_settings()
    app = FastAPI(
        title="AI Agent API",
        description="重构后的多角色 AI Agent 系统 API",
        version="1.1.0",
        lifespan=create_lifespan(settings),
    )
    startup_metrics.mark("fastapi_app_created")

    configure_middleware(app, settings)
    mount_static_assets(app, settings)
    return app


def configure_middleware(app: FastAPI, settings: AppSettings) -> None:
    if settings.enable_http_logging:
        app.add_middleware(LoggingMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[
            "X-Sample-Rate",
            "X-Channels",
            "X-Bit-Depth",
            "X-Request-ID",
            "X-Process-Time",
        ],
        max_age=3600,
    )


def mount_static_assets(app: FastAPI, settings: AppSettings) -> None:
    app.mount("/static", StaticFiles(directory=str(settings.assets_dir)), name="static")


def create_lifespan(settings: AppSettings):
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if getattr(sys, "frozen", False):
            monitor_thread = threading.Thread(target=watch_parent_process, daemon=True)
            monitor_thread.start()

        setup_logging(
            log_level=settings.log_level,
            log_dir=settings.logs_dir,
            is_development=(settings.app_env == "development"),
            defer_file_logging=True,
        )
        startup_metrics.mark("logging_ready")

        logger = get_logger(__name__)
        logger.info("系统正在启动...")

        await initialize_startup_dependencies(app)
        startup_metrics.mark("lifespan_dependencies_ready")

        logger.success(
            f"[OK] ATRI Backend Service is ready on port {settings.backend_port}"
        )
        logger.info(
            f"Environment: {settings.app_env} | Runtime Mode: {settings.runtime_mode} | "
            f"Data Root: {settings.data_dir} | PID: {os.getpid()} | Parent PID: {os.getppid()}"
        )
        logger.info(f"启动阶段耗时快照: {startup_metrics.snapshot()}")
        schedule_background_startup_tasks(app, logger)

        yield

        from core.dependencies import close_checkpointer
        from core.runtime_status import get_capability_registry

        await get_capability_registry().cancel_background_tasks()
        await close_checkpointer()
        logger.info("系统已安全关闭")

    return lifespan


async def initialize_startup_dependencies(app: FastAPI) -> None:
    async def task_routes():
        await asyncio.to_thread(
            register_routes,
            app,
            CRITICAL_ROUTE_SPECS,
            "critical_routes_registered",
        )

    async def task_db():
        from core.db import init_db

        init_db()

    async def task_checkpointer():
        from core.dependencies import init_checkpointer

        await init_checkpointer()

    await asyncio.gather(
        task_routes(),
        task_db(),
        task_checkpointer(),
    )


def schedule_background_startup_tasks(app: FastAPI, logger) -> None:
    from core.runtime_status import get_capability_registry

    warmup_capabilities = get_capability_registry().schedule_startup_warmups()
    if warmup_capabilities:
        logger.info(f"已调度后台能力预热: {', '.join(warmup_capabilities)}")

    asyncio.create_task(asyncio.to_thread(ensure_file_logging))
    asyncio.create_task(
        asyncio.to_thread(
            register_routes,
            app,
            DEFERRED_ROUTE_SPECS,
            "background_routes_registered",
        )
    )


def run_server(app: FastAPI, settings: AppSettings | None = None) -> None:
    import uvicorn

    settings = settings or get_settings()
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=settings.backend_port,
        log_level="warning",
        use_colors=False,
        access_log=False,
    )
