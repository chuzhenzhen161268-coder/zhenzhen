#!/usr/bin/env python3
"""
画布本地写服务：静态文件 + 落盘 API。

由 lon-proto-canvas 的 build_canvas.py 拷进站点目录，供 lon-lan-launcher 生成的启动器按
相对路径调用；不属于发布产物（export_site.py 会剔除）。只用标准库，可脱离 skill 目录运行。

  POST /api/canvas/probe        → 能力声明 {ok, features}
  POST /api/canvas/image        → 图片落到 assets/canvas-images/<sha256>.<ext>
  PUT  /api/canvas/annotations  → annotations.json + annotations.js 镜像
  PUT  /api/canvas/layout       → layout.json + layout.js 镜像
  PUT  /api/canvas/view         → pages.json 的 viewDefaults（只改这一节，不碰扫描结果）
  GET  /api/canvas/refs         → 实时扫 refs/ 下的 HTML 清单（只读，不写盘）
  GET  /*                       → 静态文件

JSON 写入规则：服务端盖 updatedAt（毫秒 ISO，Z 结尾），客户端传来的值被覆盖；先写临时
文件再 os.replace，磁盘上不会出现半截文件；json 与 .js 镜像由同一个函数写出。

Usage:
  python3 canvas_server.py <port> <root_dir> <annotations_file>
"""
from __future__ import annotations
import hashlib
import json
import os
import re
import sys
import threading
from datetime import datetime, timezone
from html import unescape as html_unescape
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable

# 图片上传白名单：Content-Type → 落盘扩展名。文件名由服务端按内容哈希生成，
# 不接受客户端传来的任何文件名，从根上断掉路径穿越。
IMAGE_TYPES = {
    "image/webp": ".webp",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
}
IMAGE_MAX_BYTES = 8 * 1024 * 1024
IMAGE_DIR_NAME = "canvas-images"
JSON_MAX_BYTES = 4 * 1024 * 1024

# 画布左上角「相关文档」区的数据源：站点目录下的 refs/，放评审时要对照的独立 HTML
# 文档（竞品调研、埋点方案等）。只认 HTML——列表项是直接新标签页打开的链接，
# 收别的格式就得替浏览器操心怎么渲染。
REFS_DIR_NAME = "refs"
REFS_SUFFIXES = (".html", ".htm")
TITLE_SCAN_BYTES = 8192
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_TAG_RE = re.compile(r"<[^>]*>")

# pages.json 里允许画布改写的字段。其余内容是 build_canvas.py 的扫描产物，
# 画布没有覆盖它们的权限——白名单而不是黑名单，开新字段必须在这里显式加。
VIEW_WRITABLE_KEYS = {"locked"}


def now_iso() -> str:
    """毫秒精度、Z 结尾的 UTC 时间戳；与 layout.py::now_iso 同格式（本文件不能 import 它）。"""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def mirror_source(name: str, data: Any) -> str:
    """json 的 <script src> 镜像：file:// 下 fetch 不可用，画布改走 <script src="<name>.js"> 读同一份数据。

    数据里的 </script> 会就地截断宿主 script 标签，把后面的内容甩进 HTML——一条贴了 HTML
    片段的标注就足以让整份 annotations 镜像失效；U+2028 / U+2029 在 JS 字符串字面量里又算
    换行。两者一律转成 \\u 转义：它们只可能落在字符串内部，转义后取回来的值一模一样。
    """
    payload = (
        json.dumps(data, ensure_ascii=False)
        .replace("<", "\\u003c")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )
    return (
        "window.__CANVAS_DATA__ = window.__CANVAS_DATA__ || {};\n"
        f"window.__CANVAS_DATA__[{json.dumps(name)}] = {payload};\n"
    )


def _write_atomic(path: Path, text: str) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


# ThreadingHTTPServer 下多个请求可能并发落到同一目标文件（如 annotations.json）；
# _write_atomic 对同一 path 永远产生同一个 .tmp 文件名，不加锁会被另一线程抢先
# os.replace 走，撞上 FileNotFoundError。锁把「写 json + 写 js 镜像」整体串行化，
# 顺带保证两个文件不会来自两次不同的请求。
_WRITE_LOCK = threading.Lock()


def _write_json_with_mirror_unlocked(path: Path, data: Any) -> Path:
    """write_json_with_mirror 的裸身：调用方必须已持有 _WRITE_LOCK。

    _WRITE_LOCK 不可重入，read-modify-write 那条路径要把「读 + 改 + 写」整体圈在锁里，
    没法再调加锁版本，只能共用这个不加锁的实现。
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    _write_atomic(path, json.dumps(data, ensure_ascii=False, indent=2))
    mirror = path.with_suffix(".js")
    _write_atomic(mirror, mirror_source(path.stem, data))
    return mirror


def write_json_with_mirror(path: Path, data: Any) -> Path:
    """写 <stem>.json（缩进 2）与 <stem>.js 镜像，返回镜像路径。"""
    with _WRITE_LOCK:
        return _write_json_with_mirror_unlocked(path, data)


def write_mirror(path: Path, key: str, data: Any) -> Path:
    """只写一个 js 镜像，不写 json 正本，返回镜像路径。

    给正本不是 json 的数据用（如 dev-prd 下的 markdown 正文）：那份 md 自己就是正本，
    再落一份 json 等于把同样的内容在磁盘上存三遍。key 与 path 分开传——镜像的取数键要用
    站点内相对路径（dev-prd/<文件名>），而 path.stem 拿不到目录那一段。
    """
    with _WRITE_LOCK:
        path.parent.mkdir(parents=True, exist_ok=True)
        _write_atomic(path, mirror_source(key, data))
    return path


def update_view_defaults(path: Path, patch: dict) -> dict:
    """把 patch 合并进 pages.json 的 viewDefaults，返回合并后的那一节。

    read-modify-write 整体在 _WRITE_LOCK 内完成：两次并发的锁定切换若各自读到同一份旧数据
    再分别写回，后写的那次会带着过期的兄弟字段盖掉先写的结果。

    只认已存在的 pages.json。文件缺失或读不出来时抛错让调用方回错误码，绝不新建一份——
    那等于用一个空壳顶掉整站的页面清单。
    """
    with _WRITE_LOCK:
        if not path.exists():
            raise FileNotFoundError(f"{path.name} 不存在，先跑一次画布生成")
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError(f"{path.name} 顶层不是 JSON object")
        view = data.get("viewDefaults")
        if not isinstance(view, dict):
            view = {}
        view.update(patch)
        data["viewDefaults"] = view
        _write_json_with_mirror_unlocked(path, data)
        return view


def _reject_constant(name: str) -> None:
    # json.loads 默认接受 NaN / Infinity，写回磁盘后浏览器 r.json() 直接抛错
    raise ValueError(f"JSON 不允许 {name}")


def _validate_layout_shape(data: Any) -> str | None:
    """layout payload 的最小形状校验：只查顶层与 frames / shapes 的类型，元素级交给 layout.py。"""
    if not isinstance(data, dict):
        return "顶层必须是 JSON object"
    if "frames" in data and not isinstance(data["frames"], list):
        return "frames 字段必须是数组"
    if "shapes" in data and not isinstance(data["shapes"], list):
        return "shapes 字段必须是数组"
    return None


def _validate_annotations_shape(data: Any) -> str | None:
    if not isinstance(data, dict):
        return "顶层必须是 JSON object"
    for key in ("annotations", "orphans"):
        if key in data and not isinstance(data[key], list):
            return f"{key} 字段必须是数组"
    return None


def _validate_view_shape(data: Any) -> str | None:
    """view payload 校验：白名单外的字段一律拒绝，别让画布借这条通道改别的。"""
    if not isinstance(data, dict):
        return "顶层必须是 JSON object"
    unknown = sorted(k for k in data if k not in VIEW_WRITABLE_KEYS)
    if unknown:
        return "不可写字段：" + ", ".join(unknown)
    if "locked" not in data:
        return "缺少 locked 字段"
    if not isinstance(data["locked"], bool):
        return "locked 必须是布尔值"
    return None


def doc_title(path: Path) -> str:
    """HTML 的 <title> 作展示名；读不到或没有 title 时回落文件名（不含扩展名）。

    只读文件头 TITLE_SCAN_BYTES 字节：<title> 按规范在 <head> 里，为了一个标题把
    几 MB 的报告整份读进内存不值当。解码用 replace，编码不对也只是标题花掉，不炸整张清单。
    """
    try:
        with path.open('rb') as f:
            head = f.read(TITLE_SCAN_BYTES).decode('utf-8', errors='replace')
    except OSError:
        return path.stem
    m = _TITLE_RE.search(head)
    if not m:
        return path.stem
    title = ' '.join(html_unescape(_TAG_RE.sub('', m.group(1))).split())
    return title or path.stem


def scan_refs(root: Path) -> dict:
    """扫 <root>/refs/ 下的 HTML，返回相关文档清单。

    目录不存在是常态（站点还没放过文档），返回空 files 而不是报错。
    排序按文件名升序：用户拿 `01-` 这类前缀就能自己排版面顺序，前缀原样保留在文件名里，
    展示名另走 <title>。
    """
    refs_dir = root / REFS_DIR_NAME
    files: list[dict] = []
    if refs_dir.is_dir():
        for item in sorted(refs_dir.iterdir(), key=lambda x: x.name):
            if not item.is_file() or item.suffix.lower() not in REFS_SUFFIXES:
                continue
            st = item.stat()
            files.append({
                "file": item.name,
                "title": doc_title(item),
                "mtime": st.st_mtime,
                "mtimeIso": datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat(timespec="seconds"),
                "size": st.st_size,
            })
    return {
        "version": "1",
        "generatedAt": now_iso(),
        "refsDir": REFS_DIR_NAME,
        "files": files,
    }


class CanvasHTTPRequestHandler(SimpleHTTPRequestHandler):
    """静态文件 + 画布落盘 API。"""

    annotations_file: Path
    layout_file: Path
    pages_file: Path
    image_dir: Path
    site_root: Path

    def do_GET(self) -> None:
        # API 前缀先于静态文件判定。清单只读不写盘：GET 不该有副作用，静态包里的
        # refs-index.json 由画布生成负责刷新。
        if self.path.split("?")[0] == "/api/canvas/refs":
            try:
                self._reply_json(200, scan_refs(self.site_root))
            except Exception as e:
                print(f"[错误] 相关文档清单扫描失败: {e}", file=sys.stderr)
                self._reply_json(500, {"error": str(e)})
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path == "/api/canvas/probe":
            # features 是能力声明：本文件会被拷进各站点目录，同一时刻线上跑着好几个版本。
            # 画布据此在用户按下 Cmd+V 之前就知道能不能贴图，而不是撞上 404 才发现。
            self._discard_body()
            self._reply_json(200, {"ok": True, "mode": "dev", "features": {"image": True, "view": True}})
            return
        if self.path == "/api/canvas/image":
            self._save_image()
            return
        self.send_error(404, "Not Found")

    def do_PUT(self) -> None:
        if self.path == "/api/canvas/annotations":
            self._save_json(self.annotations_file, validator=_validate_annotations_shape)
            return
        if self.path == "/api/canvas/layout":
            self._save_json(self.layout_file, validator=_validate_layout_shape)
            return
        if self.path == "/api/canvas/view":
            self._save_view()
            return
        self.send_error(404, "Not Found")

    def _reply_json(self, status: int, payload: dict) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def _discard_body(self) -> None:
        """回应前读掉请求体，避免带未读数据关连接触发 RST。

        HTTP/1.0 下服务端一回应就关连接，接收缓冲区里还压着没读的字节时内核发的是 RST
        而不是 FIN，客户端可能在读到响应前就撞上 reset。不需要请求体的分支（如 probe）
        必须先把它读干净。上限取 JSON_MAX_BYTES，超出的部分不陪着读。"""
        try:
            length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            return
        if length > 0:
            self.rfile.read(min(length, JSON_MAX_BYTES))

    def _read_body(self, max_bytes: int) -> bytes | None:
        """读请求体；空、超限、不完整时已回错误并返回 None。"""
        try:
            length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            self._reply_json(400, {"error": "Content-Length 非法"})
            return None
        if length <= 0:
            self._reply_json(400, {"error": "请求体为空"})
            return None
        if length > max_bytes:
            # 小幅超限时先把请求体读掉再回错：HTTP/1.0 下服务端一回应就关连接，客户端还在
            # 写 body 会撞上连接重置，拿不到这个 413；离谱的超限直接断开，不陪着读
            if length <= max_bytes * 4:
                self.rfile.read(length)
            self._reply_json(413, {"error": f"请求体超过 {max_bytes // (1024 * 1024)}MB 上限"})
            return None
        body = self.rfile.read(length)
        if len(body) != length:
            self._reply_json(400, {"error": "请求体不完整"})
            return None
        return body

    def _save_image(self) -> None:
        """把请求体当图片二进制落盘，返回站点内相对路径。

        文件名取内容 sha256 前 16 位 + 白名单映射出的扩展名：同一张图重复粘贴命中同一个文件，
        客户端无从指定路径。
        """
        try:
            ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            ext = IMAGE_TYPES.get(ctype)
            if ext is None:
                # 与 _read_body 的 413 分支同理：不读走请求体就回应，HTTP/1.0 关连接时
                # 发的是 RST，客户端拿不到这个 415，只看到 connection reset
                self._discard_body()
                self._reply_json(415, {"error": f"不支持的图片类型：{ctype or '(缺失)'}"})
                return
            body = self._read_body(IMAGE_MAX_BYTES)
            if body is None:
                return
            name = hashlib.sha256(body).hexdigest()[:16] + ext
            self.image_dir.mkdir(parents=True, exist_ok=True)
            target = self.image_dir / name
            if not target.exists():
                target.write_bytes(body)
                print(f"[保存] {IMAGE_DIR_NAME}/{name}（{len(body)} 字节）")
            # 前端把这个值直接塞进 <img src>，相对站点根解析
            self._reply_json(200, {"ok": True, "path": f"assets/{IMAGE_DIR_NAME}/{name}"})
        except Exception as e:
            print(f"[错误] 图片保存失败: {e}", file=sys.stderr)
            self._reply_json(500, {"error": str(e)})

    def _save_json(self, target: Path, validator: Callable[[Any], str | None]) -> None:
        try:
            body = self._read_body(JSON_MAX_BYTES)
            if body is None:
                return
            try:
                data = json.loads(body.decode("utf-8"), parse_constant=_reject_constant)
            except (ValueError, UnicodeDecodeError) as e:
                self._reply_json(400, {"error": f"JSON 解析失败：{e}"})
                return
            error = validator(data)
            if error is not None:
                self._reply_json(400, {"error": error})
                return
            data["updatedAt"] = now_iso()
            write_json_with_mirror(target, data)
            print(f"[保存] {target.name} 已更新")
            self._reply_json(200, {"ok": True, "updatedAt": data["updatedAt"]})
        except Exception as e:
            print(f"[错误] 保存失败: {e}", file=sys.stderr)
            self._reply_json(500, {"error": str(e)})

    def _save_view(self) -> None:
        """站点默认视图偏好落盘：只改 pages.json 的 viewDefaults，扫描结果原样不动。

        画布的锁定开关走这条路，评审包上传到任意静态托管后打开就是发出去时的那个状态。
        """
        try:
            body = self._read_body(JSON_MAX_BYTES)
            if body is None:
                return
            try:
                data = json.loads(body.decode("utf-8"), parse_constant=_reject_constant)
            except (ValueError, UnicodeDecodeError) as e:
                self._reply_json(400, {"error": f"JSON 解析失败：{e}"})
                return
            error = _validate_view_shape(data)
            if error is not None:
                self._reply_json(400, {"error": error})
                return
            view = update_view_defaults(self.pages_file, data)
            print(f"[保存] {self.pages_file.name} viewDefaults 已更新：{view}")
            self._reply_json(200, {"ok": True, "viewDefaults": view})
        except (FileNotFoundError, ValueError) as e:
            # 站点目录里没有 pages.json 或它已损坏：重试多少次都是同样的结果，回 409 让前端别重试
            print(f"[错误] 视图偏好保存失败: {e}", file=sys.stderr)
            self._reply_json(409, {"error": str(e)})
        except Exception as e:
            print(f"[错误] 视图偏好保存失败: {e}", file=sys.stderr)
            self._reply_json(500, {"error": str(e)})

    def send_head(self):
        """剥掉条件请求头，静态文件永远回全量。

        同一个 127.0.0.1:<port> 会被不同原型项目轮流占用，而浏览器 HTTP 缓存按 URL 存、
        跨项目共享。父类的 If-Modified-Since 只比时间戳大小：另一个项目留在同一路径上的
        同名文件（如 /demo/demo.html）若 mtime 更晚，本项目这份更早的文件会被判成「未修改」
        而回 304，浏览器于是渲染上一个项目的页面。本地服务不差这点带宽，条件请求直接不认。
        """
        del self.headers["If-Modified-Since"]
        del self.headers["If-None-Match"]
        return super().send_head()

    def end_headers(self) -> None:
        # 原型改完要立刻看到；no-store 让浏览器连副本都不留，换项目复用同一端口时不会命中旧站点
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        super().end_headers()


def main() -> int:
    if len(sys.argv) < 4:
        print("Usage: canvas_server.py <port> <root_dir> <annotations_file>", file=sys.stderr)
        return 1

    port = int(sys.argv[1])
    root_dir = Path(sys.argv[2]).resolve()
    annotations_file = Path(sys.argv[3]).resolve()

    if not root_dir.is_dir():
        print(f"Error: root_dir is not a directory: {root_dir}", file=sys.stderr)
        return 1

    os.chdir(root_dir)
    CanvasHTTPRequestHandler.annotations_file = annotations_file
    CanvasHTTPRequestHandler.layout_file = root_dir / "layout.json"
    CanvasHTTPRequestHandler.pages_file = root_dir / "pages.json"
    CanvasHTTPRequestHandler.image_dir = root_dir / "assets" / IMAGE_DIR_NAME
    CanvasHTTPRequestHandler.site_root = root_dir

    # 画布一次拉起几十个 iframe，单线程服务会让首屏排队
    ThreadingHTTPServer.allow_reuse_address = True
    server = ThreadingHTTPServer(("0.0.0.0", port), CanvasHTTPRequestHandler)

    print(f"Canvas server running on port {port}")
    print(f"Root: {root_dir}")
    print(f"Annotations: {annotations_file}")
    print(f"Images: {CanvasHTTPRequestHandler.image_dir}")
    print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[停止] 服务器已关闭")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
