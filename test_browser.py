from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import threading
import unittest
from playwright.sync_api import sync_playwright


class OfflineTests(unittest.TestCase):
    def test_subdirectory_offline_cache_and_old_cache_cleanup(self):
        repo = Path(__file__).resolve().parent
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(repo.parent)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as runner:
                browser = runner.chromium.launch(channel=os.environ.get('BROWSER_CHANNEL') or None)
                context = browser.new_context()
                page = context.new_page()
                url = f'http://127.0.0.1:{server.server_port}/{repo.name}/rca-toolkit/index.html'
                page.goto(url)
                page.evaluate("caches.open('rca-toolkit-v1')")
                page.evaluate("navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready)")
                page.wait_for_function("navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready")
                page.reload()
                page.wait_for_function("navigator.serviceWorker.controller !== null")
                keys = page.evaluate('caches.keys()')
                self.assertNotIn('rca-toolkit-v1', keys)
                cached = page.evaluate("caches.open('rca-toolkit-v3').then(c => c.keys()).then(r => r.map(x => x.url))")
                self.assertTrue(all(f'/{repo.name}/rca-toolkit/' in item for item in cached))
                context.set_offline(True)
                page.reload()
                self.assertIn('RCA Toolkit', page.title())
                self.assertGreater(page.locator('#mainPanel').inner_text().__len__(), 0)
                browser.close()
        finally:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    unittest.main()
