import re

with open(r'C:\Users\YAVER IMAM\Downloads\SyyaimSafeG_AI_v2_Complete\safeg-complete\frontend\src\components\factory-compliance.jsx', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

replacements = {
    '\u00f0\u009f\u00ad\u00ad': '\U0001f3ed',
    '\u00f0\u009f\u0093\u008a': '\U0001f4ca',
    '\u00f0\u009f\u0093\u00b9': '\U0001f4f9',
    '\u00f0\u009f\u00a6\u00ba': '\U0001f9ba',
    '\u00e2\u009a\u00a0\u00ef\u00b8\u008f': '\u26a0\ufe0f',
    '\u00f0\u009f\u0093\u008b': '\U0001f4cb',
    '\u00e2\u009c\u0085': '\u2705',
    '\u00f0\u009f\u0093\u0084': '\U0001f4c4',
    '\u00f0\u009f\u009a\u00a8': '\U0001f6a8',
    '\u00f0\u009f\u0094\u00b4': '\U0001f534',
    '\u00f0\u009f\u00a7\u00a4': '\U0001f9e4',
    '\u00f0\u009f\u0092\u00a2': '\U0001f462',
    '\u00f0\u009f\u00a5\u00bd': '\U0001f97d',
    '\u00f0\u009f\u008e\u00a7': '\U0001f3a7',
    '\u00f0\u009f\u0094\u00a9': '\U0001f529',
    '\u00e2\u009a\u00a1': '\u26a1',
    '\u00f0\u009f\u008e\u00a8': '\U0001f3a8',
    '\u00f0\u009f\u009a\u009c': '\U0001f69c',
    '\u00f0\u009f\u0094\u00a7': '\U0001f527',
    '\u00e2\u009a\u0099\u00ef\u00b8\u008f': '\u2699\ufe0f',
    '\u00f0\u009f\u00a4\u0096': '\U0001f916',
    '\u00f0\u009f\u0092\u00be': '\U0001f4be',
    '\u00f0\u009f\u0096\u00a8\u00ef\u00b8\u008f': '\U0001f5a8\ufe0f',
    '\u00f0\u009f\u0093\u00a4': '\U0001f4e4',
    '\u00e2\u009b\u0091\u00ef\u00b8\u008f': '\u26d1\ufe0f',
    '\u00f0\u009f\u0094\u00a5': '\U0001f525',
    '\u00f0\u009f\u00a7\u00aa': '\U0001f9ea',
    '\u00f0\u009f\u009a\u0097': '\U0001f697',
    '\u00f0\u009f\u009a\u0087': '\U0001f687',
    '\u00f0\u009f\u0098\u00b7': '\U0001f637',
    '\u00e2\u0084\u00b9\u00ef\u00b8\u008f': '\u2139\ufe0f',
    '\u00f0\u009f\u009b\u0095': '\U0001f6d5',
    '\u00f0\u009f\u0093\u009c': '\U0001f4dc',
    '\u00f0\u009f\u00a5\u00af': '\U0001f3e5',
    '\u00e2\u0086\u0093': '\u2193',
    '\u00e2\u0086\u0091': '\u2191',
    '\u00e2\u0080\u0094': '\u2014',
    '\u00c2\u00b7': '\u00b7',
    '\u00e2\u0080\u0099': '\u2019',
    '\u00e2\u0080\u009c': '\u201c',
    '\u00e2\u0080\u009d': '\u201d',
    '\u00c2\u00a0': ' ',
}

for bad, good in replacements.items():
    content = content.replace(bad, good)

with open(r'C:\Users\YAVER IMAM\Downloads\SyyaimSafeG_AI_v2_Complete\safeg-complete\frontend\src\components\factory-compliance.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
