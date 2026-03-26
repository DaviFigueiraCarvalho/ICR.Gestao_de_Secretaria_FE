import re, pathlib
base = pathlib.Path('client/src/pages')
files = list(base.glob('*.tsx'))
for f in files:
    text = f.read_text(encoding='utf-8')
    text_new = re.sub(r"(['\"])\/api\/(?!v1\/)([^'\"]+)\1", lambda m: f"{m.group(1)}/api/v1/{m.group(2)}{m.group(1)}", text)
    text_new = re.sub(r"pageSize=([0-9]+)", r"size=\1", text_new)
    if text_new != text:
        f.write_text(text_new, encoding='utf-8')
        print(f"Updated {f}")
print('Done')
