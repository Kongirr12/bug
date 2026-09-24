import re
import os

app_data_dir = "/Users/macos/.gemini/antigravity/brain/859eb5f6-be75-4292-a5a9-30f2d8dd9a4d"
extracted_file = os.path.join(app_data_dir, "scratch/extracted_thai.html")

with open(extracted_file, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add api.js before <body>
body_start = html.find('<body>')
if body_start == -1:
    body_start = 0
injection = '\n    <script src="./js/api.js"></script>\n    <link rel="stylesheet" href="./css/style.css">\n'
html = html[:body_start] + injection + html[body_start:]

# 2. Modify the school name and add credit as requested earlier
html = html.replace('โรงเรียนบ้านสันติสุข สพป.เชียงราย เขต 3', 'โรงเรียนมหาชัยพิทยาคาร สำนักงานเขตพื้นที่การศึกษามัธยมศึกษามหาสารคาม')
html = html.replace('โรงเรียนบ้านสันติสุข สพป.ชร.3', 'โรงเรียนมหาชัยพิทยาคาร')

# 3. Add Developer Credit in Login Screen
html = html.replace('<p class="text-white-50 mb-4" style="font-size:0.95rem;">โรงเรียนมหาชัยพิทยาคาร สำนักงานเขตพื้นที่การศึกษามัธยมศึกษามหาสารคาม</p>',
                    '<p class="text-white-50 mb-1" style="font-size:0.95rem;">โรงเรียนมหาชัยพิทยาคาร สำนักงานเขตพื้นที่การศึกษามัธยมศึกษามหาสารคาม</p><p class="text-white-50 mb-4" style="font-size:0.8rem;">พัฒนาโดย ครูก้องนที อุ่นเจริญ</p>')

# 4. Add Developer Credit in Footer
html = html.replace('<div class="sidebar-footer">', '<div class="sidebar-footer"><div style="font-size: 0.75rem; color: #94a3b8; text-align: center; margin-bottom: 12px;">พัฒนาโดย ครูก้องนที อุ่นเจริญ</div>')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Generated index.html from extracted source.")
