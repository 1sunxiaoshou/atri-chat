from dotenv import load_dotenv

# Load .env once without overriding the runtime contract injected by Tauri.
load_dotenv(override=False)

from core.bootstrap import create_app, run_server

app = create_app()


if __name__ == "__main__":
    run_server(app)
