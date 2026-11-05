"""Bundle a completed Vite build into a downloadable, self-contained HTML file."""
import base64
import mimetypes
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
dist = root / "dist"
html = (dist / "index.html").read_text()


def data_url(path):
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def inline_css(match):
    css_path = dist / match.group(1).lstrip("/")
    css = css_path.read_text()

    def inline_url(url_match):
        url = url_match.group(1).strip("\"'")
        if url.startswith("data:"):
            return url_match.group(0)
        asset = dist / url.lstrip("/") if url.startswith("/") else css_path.parent / url
        return f'url("{data_url(asset)}")'

    return "<style>" + re.sub(r"url\(([^)]+)\)", inline_url, css) + "</style>"


html = re.sub(r'<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>', inline_css, html)
html = re.sub(
    r'<script type="module"[^>]*src="([^"]+)"[^>]*></script>',
    lambda m: '<script type="module">' + (dist / m.group(1).lstrip("/")).read_text().replace("</script", r"<\/script") + "</script>",
    html,
)
html = html.replace('href="/favicon.svg"', f'href="{data_url(dist / "favicon.svg")}"')
output = Path(sys.argv[1]) if len(sys.argv) > 1 else dist / "dolya.html"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html)
print(f"Exported: {output} ({output.stat().st_size} bytes)")
