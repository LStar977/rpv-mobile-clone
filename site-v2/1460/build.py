"""Assemble The Other 1,460 Days from src.html.

Embeds the two photographs and the icon as base64 so the page is one
self-contained file, then writes two outputs:
  index.html    - full document, served at representvote.com/1460
  artifact.html - head + body fragment, for publishing as an Artifact
"""
import base64
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))

def b64(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode('ascii')

src = open(os.path.join(HERE, 'src.html'), encoding='utf-8').read()
src = src.replace('{{GYM}}', b64(os.path.join(ROOT, 'pitch/emotional/final-images/slide-02-gym.jpg')))
src = src.replace('{{KITCHEN}}', b64(os.path.join(ROOT, 'pitch/emotional/final-images/slide-08-kitchen.jpg')))
src = src.replace('{{ICON}}', b64(os.path.join(ROOT, 'site-v2/assets/icon.png')))

head = re.search(r'<!--HEAD-->(.*?)<!--/HEAD-->', src, re.S).group(1).strip()
body = re.search(r'<!--BODY-->(.*?)<!--/BODY-->', src, re.S).group(1).strip()

index = (
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    '<meta name="theme-color" content="#040707">\n'
    + head + '\n</head>\n<body>\n' + body + '\n</body>\n</html>\n'
)
open(os.path.join(HERE, 'index.html'), 'w', encoding='utf-8').write(index)
open(os.path.join(HERE, 'artifact.html'), 'w', encoding='utf-8').write(head + '\n' + body + '\n')
print('index.html %d KB · artifact.html %d KB' % (len(index) // 1024, (len(head) + len(body)) // 1024))
