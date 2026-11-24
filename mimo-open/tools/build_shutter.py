"""셔터 영상 한 편을 사이트용 프레임과 치수 파일로 바꾼다.

쓰는 법:  python3 tools/build_shutter.py source/shutter-draft-480p.mp4
결과:     assets/shutter/f_000.webp ... , assets/shutter/poster.jpg, assets/shutter/meta.js

화질을 올린 영상이 생기면 같은 명령에 그 파일을 넣어 다시 돌리면 된다.
조건: 카메라가 고정이고, 셔터 뒤 가게 안이 검게 나온 영상.
"""
import glob, json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image

src = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, "assets", "shutter")
DARK = 30  # 이 밝기보다 어두우면 가게 안으로 본다

tmp = tempfile.mkdtemp()
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, os.path.join(tmp, "f_%04d.png")], check=True)
files = sorted(glob.glob(os.path.join(tmp, "f_*.png")))
luma = lambda p: np.asarray(Image.open(p).convert("L"), dtype=np.float32)

# 다 열린 마지막 프레임에서 문 자리(검은 네모)를 잰다
L = luma(files[-1]); H, W = L.shape
k = H / 854
cols = L[int(330 * k):int(640 * k)].mean(axis=0)
dark = np.where(cols < DARK - 2)[0]; x0, x1 = int(dark.min()), int(dark.max())
m = int(12 * k)
frac = (L[:, x0 + m:x1 - m] < DARK).mean(axis=1)
y_top = int(np.where(frac > 0.9)[0].min()); y_bot = int(np.where(frac > 0.5)[0].max())

# 프레임마다 셔터 아랫단 높이를 잰다 (바닥에서 위로 훑는다)
edges = []
for f in files:
    fr = (luma(f)[:, x0 + m:x1 - m] < DARK).mean(axis=1)
    y = y_bot
    if fr[y - 2:y + 1].max() < 0.5:
        edges.append(y_bot + 1); continue
    while y > y_top and fr[y - 1] > 0.5: y -= 1
    edges.append(y)
edges = np.minimum.accumulate(np.array(edges))  # 한 번 올라간 셔터는 내려오지 않는다
moving = np.where(edges < y_bot - 1)[0]
a = max(int(moving.min()) - 2, 0)
b = min(int(np.where(edges <= edges.min() + 1)[0].min()) + 2, len(files) - 1)

for old in glob.glob(os.path.join(out, "f_*.webp")): os.remove(old)
os.makedirs(out, exist_ok=True)
for i, idx in enumerate(range(a, b + 1)):
    Image.open(files[idx]).convert("RGB").save(os.path.join(out, f"f_{i:03d}.webp"), quality=80, method=6)
Image.open(files[a]).convert("RGB").save(os.path.join(out, "poster.jpg"), quality=84)

meta = {"w": W, "h": H, "n": b - a + 1,
        "hole": {"x0": x0 + 1, "x1": x1 + 1, "yb": int(y_bot + 13 * k)},
        "edges": [int(e) + 1 for e in edges[a:b + 1]]}
with open(os.path.join(out, "meta.js"), "w") as fh:
    fh.write("window.SHUTTER=" + json.dumps(meta, separators=(",", ":")) + ";\n")
print(meta["w"], meta["h"], "frames", meta["n"], "hole", meta["hole"], "edge", meta["edges"][0], "->", meta["edges"][-1])
