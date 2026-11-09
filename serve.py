# Dev server for the game: plain static files, caching turned off.
#
# The game is ES modules with no build step, which means the URL of a module never
# changes. `python -m http.server` sends no cache headers at all, so browsers fall back
# to heuristic freshness and happily keep serving a module you have already edited —
# the page then loads a new importer against a stale module and dies with "does not
# provide an export named ...". Sending `no-store` on every response makes each reload
# read the files again, which is what a development server should do.
import http.server
import os
import socketserver
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    with Server(('127.0.0.1', port), Handler) as httpd:
        print(f'serving {os.getcwd()} on http://127.0.0.1:{port}', flush=True)
        httpd.serve_forever()
