with open(r'C:\Users\YAVER IMAM\Downloads\SyyaimSafeG_AI_v2_Complete\safeg-complete\frontend\src\pages\admin\AdminDashboard.jsx', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

fixes = {
    # Broken separators
    'Safeguards IQ \ufffd INTERNAL': 'Safeguards IQ — INTERNAL',
    'Admin access only \ufffd contact': 'Admin access only — contact',
    'Node {sysInfo.server.nodeVersion} \ufffd {sysInfo.server.memUsedMB}MB': 'Node {sysInfo.server.nodeVersion} · {sysInfo.server.memUsedMB}MB',
    '{s.tech} \ufffd :{s.port}': '{s.tech} · :{s.port}',
    # Broken em dashes in STACK details  
    '16\ufffd32 cameras': '16–32 cameras',
    '4\ufffd8 FPS': '4–8 FPS',
    'streams \ufffd no': 'streams — no',
    'React \ufffd this screen': 'React — this screen',
    # Broken arrow in dataflow
    '"?"': '"→"',
    # Broken question marks in expand/collapse
    '{open===i?"?":"?"}': '{open===i?"▲":"▼"}',
    # Broken in customers
    '{c.company_name || "\ufffd"}': '{c.company_name || "—"}',
    '{c.email || "\ufffd"}': '{c.email || "—"}',
    'c.plan_id||"\ufffd"': 'c.plan_id||"—"',
    'c.camera_count||"\ufffd"': 'c.camera_count||"—"',
    'c.subscription_status||"\ufffd"': 'c.subscription_status||"—"',
    '? "—"': ': "—"',
    '? Export CSV': '⬇ Export CSV',
    # Loading dots
    "val: loading ? '\ufffd'": "val: loading ? '…'",
    "p.invoice_no||'\ufffd'": "p.invoice_no||'—'",
    "p.customer_name||'\ufffd'": "p.customer_name||'—'",
    "p.plan_id||'\ufffd'": "p.plan_id||'—'",
    # Password placeholder
    'ph:"\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd"': 'ph:"••••••••••••"',
}

for bad, good in fixes.items():
    content = content.replace(bad, good)

# Fix all remaining replacement chars
import re
content = re.sub(r'\ufffd', '—', content)

with open(r'C:\Users\YAVER IMAM\Downloads\SyyaimSafeG_AI_v2_Complete\safeg-complete\frontend\src\pages\admin\AdminDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
