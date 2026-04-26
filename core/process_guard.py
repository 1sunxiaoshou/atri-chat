"""Process lifetime helpers for packaged desktop runtime."""

from __future__ import annotations

import os
import time

import psutil


def watch_parent_process() -> None:
    """Exit the backend when the parent desktop process disappears."""
    parent_pid = os.getppid()
    if parent_pid <= 1:
        return

    while True:
        if not psutil.pid_exists(parent_pid):
            os._exit(0)
        time.sleep(2)
