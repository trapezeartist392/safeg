with open(r'C:\Users\YAVER IMAM\Downloads\SyyaimSafeG_AI_v2_Complete\safeg-complete\frontend\src\components\factory-compliance.jsx', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

content = content.replace('\u00e2\u0080\u0094', '\u2014')
content = content.replace('\u00e2\u0080\u0093', '\u2013')
content = content.replace('\u00c2\u00b7', '\u00b7')
content = content.replace('\u00e2\u0080\u0099', '\u2019')

with open(r'C:\Users\YAVER IMAM\Downloads\SyyaimSafeG_AI_v2_Complete\safeg-complete\frontend\src\components\factory-compliance.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
