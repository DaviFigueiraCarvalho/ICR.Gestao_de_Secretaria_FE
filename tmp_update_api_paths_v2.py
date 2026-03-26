import pathlib
base = pathlib.Path('client/src/pages')
for f in base.glob('*.tsx'):
    text = f.read_text(encoding='utf-8')
    text_new = text.replace("'/api/", "'/api/v1/").replace('\"/api/', '\"/api/v1/')
    text_new = text_new.replace("'/api/v1/v1/", "'/api/v1/").replace('\"/api/v1/v1/', '\"/api/v1/')
    text_new = text_new.replace('pageSize=', 'size=')
    if text_new != text:
        f.write_text(text_new, encoding='utf-8')
        print('Updated', f)
print('Done')
