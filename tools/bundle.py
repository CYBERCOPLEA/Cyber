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
open(out, 'w', encoding='utf-8').write(html)
print(out, round(len(html.encode()) / 1e6, 2), 'MB')
