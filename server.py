import logging
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
HOST = os.environ.get("TODO_HOST", "127.0.0.1")
PORT = int(os.environ.get("TODO_PORT", "8000"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("todo-preview")


def main():
    handler = partial(SimpleHTTPRequestHandler, directory=str(PUBLIC_DIR))
    server = ThreadingHTTPServer((HOST, PORT), handler)
    logger.info("Pratinjau lokal: http://%s:%s", HOST, PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Server pratinjau dihentikan.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
