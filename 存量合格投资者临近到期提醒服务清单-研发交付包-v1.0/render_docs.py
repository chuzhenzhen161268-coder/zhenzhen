from pathlib import Path
import html
import os
import re

import mistune


ROOT = Path(__file__).parent
renderer = mistune.create_markdown(plugins=["table", "strikethrough", "task_lists"])
css = """body{font:15px/1.75 -apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;color:#263442;margin:0;background:#f5f7f9}main{max-width:980px;margin:32px auto;padding:32px 42px;background:white;border:1px solid #e2e7eb;border-radius:6px}h1,h2,h3{line-height:1.35;color:#173b5c}h1{font-size:28px;border-bottom:1px solid #e8edf1;padding-bottom:12px}h2{font-size:21px;margin-top:34px}table{border-collapse:collapse;width:100%;display:block;overflow:auto}th,td{border:1px solid #dce3e9;padding:8px 10px;vertical-align:top}th{background:#f1f5f8}pre{background:#f4f6f8;padding:14px;overflow:auto;border-radius:4px}code{background:#f2f4f6;padding:2px 4px;border-radius:3px}blockquote{border-left:3px solid #6b95b7;margin-left:0;padding-left:14px;color:#536575}a{color:#17699d}img{max-width:100%}.mermaid{margin:20px 0;padding:20px;overflow:auto;border:1px solid #dce3e9;border-radius:8px;background:#fbfcfe}.source{display:inline-block;margin-bottom:18px;font-size:12px;color:#73818e}.top{position:sticky;top:0;background:#fff;padding:10px 0;border-bottom:1px solid #eef1f3}"""


def make_html(source: Path) -> None:
    text = source.read_text(encoding="utf-8")
    body = renderer(text)
    body = re.sub(
        r'href="([^"#]+?)\.md(#[^"]*)?"',
        lambda match: 'href="' + match.group(1) + ".html" + (match.group(2) or '"'),
        body,
    )
    body = re.sub(
        r'<pre><code class="language-mermaid">(.*?)</code></pre>',
        lambda match: '<div class="mermaid">' + html.unescape(match.group(1)) + '</div>',
        body,
        flags=re.DOTALL,
    )
    relative = source.relative_to(ROOT)
    back = "../" * len(relative.parent.parts) + "交付中心.html"
    mermaid = os.path.relpath(ROOT / "assets/vendor/mermaid/dist/mermaid.min.js", source.parent)
    title = html.escape(source.stem)
    page = (
        '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>{title}</title><style>{css}</style></head><body><main>"
        f'<div class="top"><a href="{back}">返回交付中心</a>　'
        f'<a href="{source.name}">查看/下载 Markdown 原文</a></div>'
        f'<span class="source">离线阅读版 · 源文件：{html.escape(source.name)}</span>'
        f'{body}</main><script src="{mermaid}"></script>'
        '<script>mermaid.initialize({startOnLoad:true,theme:"neutral",flowchart:{useMaxWidth:true,htmlLabels:true}});</script>'
        "</body></html>"
    )
    source.with_suffix(".html").write_text(page, encoding="utf-8")
    print(source.with_suffix(".html"))


for markdown in sorted((ROOT / "docs").rglob("*.md")) + [ROOT / "研发交付说明.md"]:
    make_html(markdown)
