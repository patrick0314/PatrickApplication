import http.server
import socket
import socketserver
import os
import sys

PORT = 8080

def get_lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

class PWAHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable caching and CORS headers
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def guess_type(self, path):
        if path.endswith('.json') or path.endswith('manifest.json'):
            return 'application/manifest+json'
        return super().guess_type(path)

os.chdir(os.path.dirname(os.path.abspath(__file__)))

local_ip = get_lan_ip()

print("=" * 60)
print("🚀 LifeHub Mobile PWA 本機服務已啟動！")
print("=" * 60)
print(f"💻 電腦瀏覽器訪問:  http://localhost:{PORT}")
print(f"📱 手機瀏覽器訪問:  http://{local_ip}:{PORT}")
print("-" * 60)
print("📲 【手機使用指南】（請確保手機與電腦連線至相同的 Wi-Fi）：")
print(f"1. 手機打開 Safari 或 Chrome，輸入： http://{local_ip}:{PORT}")
print("2. iOS iPhone: 點擊下方分享按鈕 (📤) -> 點選「加入主畫面」")
print("3. Android: 點擊右上選單 (⋮) -> 點選「安裝應用程式」或「加到主畫面」")
print("4. 從手機桌面點擊圖示，即可全螢幕體驗原生 App 質感！")
print("=" * 60)
print("按 Ctrl + C 可隨時停止服務。\n")

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), PWAHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n服務已停止。")
