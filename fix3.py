with open(r'C:\Users\YAVER IMAM\Downloads\SyyaimSafeG_AI_v2_Complete\safeg-complete\frontend\src\components\factory-compliance.jsx', 'rb') as f:
    content = f.read()

content = content.replace(b'\xe2\x80\x94', b'\xe2\x80\x94')
content = content.replace(b'\xc3\xa2\xc2\x80\xc2\x94', b'\xe2\x80\x94')
content = content.replace(b'\xc3\xa2\xc2\x80\xc2\x93', b'\xe2\x80\x93')
content = content.replace(b'\xc3\xa2\xc2\x80\xc2\x99', b'\xe2\x80\x99')
content = content.replace(b'\xc3\xa2\xc2\x80\xc2\x9c', b'\xe2\x80\x9c')
content = content.replace(b'\xc3\xa2\xc2\x80\xc2\x9d', b'\xe2\x80\x9d')
content = content.replace(b'\xc3\x82\xc2\xb7', b'\xc2\xb7')

with open(r'C:\Users\YAVER IMAM\Downloads\SyyaimSafeG_AI_v2_Complete\safeg-complete\frontend\src\components\factory-compliance.jsx', 'wb') as f:
    f.write(content)
print('Done')
