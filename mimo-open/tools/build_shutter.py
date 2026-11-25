"""셔터 영상 한 편을 사이트용 프레임과 치수 파일로 바꾼다.

쓰는 법:  python3 tools/build_shutter.py source/shutter-1080p-bytedance.mp4 [가로 폭, 기본 720]
          python3 tools/build_shutter.py source/shutter-mimo-draft-480p.mp4 480 --out assets/shutter-mimo --person --side source/shutter-1080p-bytedance.mp4
결과:     assets/shutter/f_000.webp ... , assets/shutter/poster.jpg, assets/shutter/meta.js

--person  셔터 앞에 사람(미모)이 서 있는 영상. 가게 안의 검은 부분만 투명하게 따서 사람은 남긴다
--side    넓은 화면에서 양옆에 세울 "사람 없는 닫힌 스토어" 그림을 뽑을 영상
--out     결과를 둘 폴더

셔터 영상을 바꾸려면 같은 명령에 새 파일을 넣어 다시 돌리면 된다.
가로 폭은 폰에서 끊기지 않게 720으로 줄여 쓴다(원본이 더 작으면 그대로).
조건: 카메라가 고정이고, 셔터 뒤 가게 안이 검게 나온 영상.
"""
import glob, json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image

args = sys.argv[1:]
def opt(name, has_value=True):
    if name not in args: return None
    i = args.index(name); v = args[i + 1] if has_value else True
    del args[i:i + (2 if has_value else 1)]
    return v
OUT = opt("--out"); SIDE = opt("--side"); PERSON = opt("--person", False)
src = args[0]
WIDTH = int(args[1]) if len(args) > 1 else 720
KEY = 24   # --person: 세 색 모두 이보다 어두운 점은 가게 안으로 보고 투명하게 딴다
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, OUT) if OUT else os.path.join(root, "assets", "shutter")
DARK = 30  # 이 밝기보다 어두우면 가게 안으로 본다

# 색 보정 (치수를 잰 뒤, 저장할 때만 입힌다)
# 화질을 올린 영상이 처음 드래프트보다 노랑 쪽으로 밀리고 그림자가 깊어져서 되돌린다. 0 과 None 이면 보정 없음
HUE_DEG = -6.0                                   # 색상을 돌리는 각도. 음수면 노랑에서 주황 쪽
SAT = 0.78                                       # 색의 진하기. 1 이면 그대로, 작을수록 누런 기가 빠진다
SHADOW = [(0, 0), (0.04, 0.04), (0.12, 0.158), (0.30, 0.335), (0.50, 0.515), (1, 1)]   # 밝기 곡선. 어두운 부분만 들어 올린다

def grade(im):
    a = np.asarray(im.convert("RGB"), dtype=np.float32) / 255
    if HUE_DEG:
        t = np.deg2rad(-HUE_DEG); c, s_ = np.cos(t), np.sin(t)
        to_yiq = np.array([[0.299, 0.587, 0.114], [0.596, -0.274, -0.322], [0.211, -0.523, 0.312]], dtype=np.float32)
        rot = np.array([[1, 0, 0], [0, c * SAT, -s_ * SAT], [0, s_ * SAT, c * SAT]], dtype=np.float32)
        a = a @ (np.linalg.inv(to_yiq) @ rot @ to_yiq).T
    if SHADOW:
        y = (a * np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)).sum(-1, keepdims=True)
        xs, ys = zip(*SHADOW)
        a = a * (np.interp(y, xs, ys) / np.maximum(y, 1e-4))
    return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))

tmp = tempfile.mkdtemp()
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", f"scale='min({WIDTH},iw)':-2:flags=lanczos",
                os.path.join(tmp, "f_%04d.png")], check=True)
files = sorted(glob.glob(os.path.join(tmp, "f_*.png")))
luma = lambda p: np.asarray(Image.open(p).convert("L"), dtype=np.float32)

# 다 열린 마지막 프레임에서 문 자리(검은 네모)를 잰다
L = luma(files[-1]); H, W = L.shape
k = H / 854
cols = L[int(330 * k):int(640 * k)].mean(axis=0)
dark = np.where(cols < DARK - 2)[0]; x0, x1 = int(dark.min()), int(dark.max())
m = int(12 * k)
# 사람이 있으면 사람이 서지 않는 왼쪽 띠에서만 잰다
c0, c1 = (x0 + m, x0 + m + int(0.16 * (x1 - x0))) if PERSON else (x0 + m, x1 - m)
frac = (L[:, c0:c1] < DARK).mean(axis=1)
y_top = y_bot = int(600 * k)          # 문 한가운데에서 위아래로 넓혀 간다
while y_top > 0 and frac[y_top - 1] > 0.9: y_top -= 1
while y_bot < H - 1 and frac[y_bot + 1] > (0.3 if PERSON else 0.5): y_bot += 1

# 프레임마다 셔터 아랫단 높이를 잰다 (바닥에서 위로 훑는다)
edges = []
for f in files:
    if PERSON:   # 사람 그림자가 셔터에 지므로 더 어두운 기준(가게 안만 해당)으로, 바닥 햇살 띠 위에서부터 훑는다
        fr = (luma(f)[:, c0:c1] < 16).mean(axis=1)
        y = y_bot - int(34 * k)
        if fr[y] < 0.5:
            edges.append(y_bot + 1); continue
    else:
        fr = (luma(f)[:, c0:c1] < DARK).mean(axis=1)
        y = y_bot
        if fr[y - 2:y + 1].max() < 0.5:
            edges.append(y_bot + 1); continue
    while y > y_top and fr[y - 1] > 0.5: y -= 1
    edges.append(y)
edges = np.minimum.accumulate(np.array(edges))  # 한 번 올라간 셔터는 내려오지 않는다
moving = np.where(edges < y_bot - 1)[0]
a = max(int(moving.min()) - 2, 0)
b = min(int(np.where(edges <= edges.min() + 1)[0].min()) + 2, len(files) - 1)
if PERSON: a, b = 0, len(files) - 1          # 사람이 인사하고 물러서는 장면까지 전부 쓴다

for old in glob.glob(os.path.join(out, "f_*.webp")): os.remove(old)
os.makedirs(out, exist_ok=True)
from PIL import ImageFilter, ImageDraw
def keyed(im, edge):                      # 가게 안(검은 부분)만 투명하게, 사람은 남긴다
    rgb = np.asarray(im.convert("RGB"))
    alpha = np.ones(rgb.shape[:2], dtype=np.uint8) * 255
    y0, y1 = edge + 1, int(y_bot + 13 * k)
    if edge <= y_bot:                        # 셔터가 열린 만큼만 딴다
        box = ((rgb[y0:y1, x0 + 1:x1 + 1].max(axis=2) >= KEY) * 255).astype(np.uint8)
        m = Image.fromarray(box).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))   # 점 같은 잡티 지우기
        m = m.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))                       # 가는 틈 메우기
        # 바깥(가게 안)에서 이어진 어두운 곳만 투명하게 한다. 사람 몸 안의 어두운 무늬는 남는다
        for yy in range(2, m.height - 2, 6):
            for xx in (2, m.width - 3):
                if m.getpixel((xx, yy)) == 0: ImageDraw.floodfill(m, (xx, yy), 128)
        for xx in range(2, m.width - 2, 6):
            if m.getpixel((xx, 1)) == 0: ImageDraw.floodfill(m, (xx, 1), 128)
        box = (np.asarray(m) != 128) * 255
        alpha[y0:y1, x0 + 1:x1 + 1] = box
    mask = Image.fromarray(alpha.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    out_im = grade(im).convert("RGBA"); out_im.putalpha(mask)
    return out_im
for i, idx in enumerate(range(a, b + 1)):
    im = Image.open(files[idx])
    (keyed(im, int(edges[idx])) if PERSON else grade(im)).save(os.path.join(out, f"f_{i:03d}.webp"), quality=76, method=6)
if SIDE:                                   # 양옆에 세울, 사람 없는 닫힌 스토어
    t2 = tempfile.mkdtemp()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "0.2", "-i", os.path.join(root, SIDE) if not os.path.isabs(SIDE) else SIDE,
                    "-frames:v", "1", "-vf", f"scale={W}:{H}:flags=lanczos", os.path.join(t2, "side.png")], check=True)
    grade(Image.open(os.path.join(t2, "side.png"))).save(os.path.join(out, "side.webp"), quality=78, method=6)
grade(Image.open(files[a])).save(os.path.join(out, "poster.jpg"), quality=84)

meta = {"w": W, "h": H, "n": b - a + 1, "dir": os.path.relpath(out, root).replace(os.sep, "/"), "person": bool(PERSON), "side": bool(SIDE),
        "hole": {"x0": x0 + 1, "x1": x1 + 1, "yb": int(y_bot + 13 * k)},
        "edges": [int(e) + 1 for e in edges[a:b + 1]]}
with open(os.path.join(out, "meta.js"), "w") as fh:
    js = json.dumps(meta, separators=(",", ":"))
    # 기본 셔터는 window.SHUTTER, 다른 폴더에 뽑은 셔터는 window.SHUTTERS[폴더] 에 담는다
    fh.write(("window.SHUTTER=" + js if not OUT else '(window.SHUTTERS=window.SHUTTERS||{})["' + meta["dir"] + '"]=' + js) + ";\n")
print(meta["w"], meta["h"], "frames", meta["n"], "hole", meta["hole"], "edge", meta["edges"][0], "->", meta["edges"][-1])
