with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace(r'\/', '/')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Fixed HTML escaping in index.html")
