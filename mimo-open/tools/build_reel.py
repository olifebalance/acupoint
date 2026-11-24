"""작품 영상을 음악 박자에 맞춰 잘라 첫 화면 쇼릴을 만든다.

쓰는 법:  python3 tools/build_reel.py 음악.mp3 [효과음.wav]
결과:     assets/showreel.mp4, assets/showreel-poster.jpg, assets/reel-meta.js(컷 시각표)

작품을 바꾸려면 assets/works/ 의 파일을 바꾸고 아래 SEGS 를 고친 뒤 다시 돌린다.
음악 파일은 저장소에 넣지 않는다(Epidemic Sound 구독 곡). 받을 때마다 커넥터로 내려받는다.
"""
import json, os, subprocess, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
music = sys.argv[1]
sfx = sys.argv[2] if len(sys.argv) > 2 else None

BEAT = 0.5108          # 한 박 길이(초). 「Mojito」 약 117.5 BPM
MUSIC_START = 1.02     # 곡에서 쓰기 시작하는 지점(초). 킥이 들어오는 곳
FPS = 24
TOTAL_BEATS = 28       # 마지막 장면을 멈춘 채로 채우는 전체 길이
# (작품, 시작 초, 박 수) — 박 수의 합이 제목이 박히는 시각이 된다(지금 20박 = 10.2초)
SEGS = [("burger", 0.25, 2), ("wuxia", 0.30, 2), ("andz", 8.90, 2), ("bakery", 9.60, 2), ("book", 12.30, 2),
        ("burger", 2.45, 1), ("andz", 2.65, 1), ("wuxia", 26.40, 1), ("bakery", 7.20, 1),
        ("book", 4.20, .5), ("wuxia", 22.90, .5), ("andz", 6.70, .5), ("burger", 6.20, .5),
        ("burger", 10.10, 4)]

names = sorted({n for n, _, _ in SEGS})
inputs = []
for n in names: inputs += ["-i", os.path.join(root, "assets", "works", n + ".mp4")]
inputs += ["-i", music]
if sfx: inputs += ["-i", sfx]
fc, labels, b, cuts = [], [], 0.0, []
for i, (n, st, nb) in enumerate(SEGS):
    f0 = round(b * BEAT * FPS); b += nb; f1 = round(b * BEAT * FPS); nf = f1 - f0
    cuts.append([round(f0 / FPS, 3), n])
    pad = f",tpad=stop_mode=clone:stop={round(TOTAL_BEATS * BEAT * FPS) - f1}" if i == len(SEGS) - 1 else ""
    fc.append(f"[{names.index(n)}:v]trim=start={st}:duration={nf / FPS + 0.2},setpts=PTS-STARTPTS,fps={FPS},"
              f"scale=540:960,setsar=1,trim=end_frame={nf},setpts=PTS-STARTPTS{pad}[v{i}]")
    labels.append(f"[v{i}]")
dur = round(TOTAL_BEATS * BEAT * FPS) / FPS
m = len(names)
fc.append("".join(labels) + f"concat=n={len(SEGS)}:v=1:a=0,format=yuv420p[v]")
fc.append(f"[{m}:a]atrim=start={MUSIC_START}:duration={dur},asetpts=PTS-STARTPTS,afade=t=out:st={dur - 2.4}:d=2.4[m]")
if sfx:
    fc.append(f"[{m + 1}:a]volume=0.45,apad=whole_dur={dur}[s]")
    fc.append("[m][s]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-18:TP=-1.5:LRA=11,aresample=44100[a]")
else:
    fc.append("[m]loudnorm=I=-18:TP=-1.5:LRA=11,aresample=44100[a]")
out = os.path.join(root, "assets", "showreel.mp4")
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(fc), "-map", "[v]", "-map", "[a]",
                "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-g", "48", "-movflags", "+faststart",
                "-c:a", "aac", "-b:a", "128k", "-t", str(dur), out], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "0.3", "-i", out, "-frames:v", "1", "-q:v", "4",
                os.path.join(root, "assets", "showreel-poster.jpg")], check=True)
with open(os.path.join(root, "assets", "reel-meta.js"), "w") as fh:   # 화면의 글자가 컷에 맞춰 바뀌게 하는 시각표
    fh.write("window.REEL=" + json.dumps({"titleAt": round(b * BEAT, 2), "cuts": cuts}, separators=(",", ":")) + ";\n")
print("showreel", dur, "초, 제목 시각", sum(nb for _, _, nb in SEGS[:-1]) * BEAT + SEGS[-1][2] * BEAT)
