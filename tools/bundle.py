import re, sys, os
src, out = sys.argv[1], sys.argv[2]
html = open(os.path.join(src, 'index.html'), encoding='utf-8').read()
def css(m):
    return '<style>\n' + open(os.path.join(src, m.group(1)), encoding='utf-8').read() + '\n</style>'
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, html)
def js(m):
    code = open(os.path.join(src, m.group(1)), encoding='utf-8').read()
    code = re.sub(r'</(script)', r'<\\/\1', code, flags=re.I)
    return '<script>\n' + code + '\n</script>'
html = re.sub(r'<script src="([^"]+)"></script>', js, html)
assert 'src="js/' not in html
import datetime
_ist = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(hours=5, minutes=30)
build = _ist.strftime('%Y-%m-%d %H:%M IST')
html = html.replace('__BUILD__', build)
ver = _ist.strftime('%Y%m%d%H%M')
redir = os.path.join(os.path.dirname(os.path.abspath(out)), 'index.html')
if os.path.exists(redir) and 'url=Sudarshanastra.html' in open(redir, encoding='utf-8').read():
    name = os.path.basename(out)
    open(redir, 'w', encoding='utf-8').write(
        '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><title>SudarshanAshtra</title>\n'
        '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"><meta http-equiv="Pragma" content="no-cache"><meta http-equiv="Expires" content="0">\n'
        f'<script>location.replace("{name}?v={ver}")</script>\n'
        f'<meta http-equiv="refresh" content="0; url={name}?v={ver}"></head>\n'
        f'<body style="font-family:Segoe UI,Arial,sans-serif;padding:40px">Opening <a href="{name}?v={ver}">SudarshanAshtra</a> (build {build})…</body></html>\n')
    print('redirect ->', name + '?v=' + ver)
open(out, 'w', encoding='utf-8').write(html)
print(out, round(len(html.encode()) / 1e6, 2), 'MB')
