# MIMO 사이트 — 「셔터가 올라가면」 (코드결 3차, 1단계)

1차(`mimo/`), 2차(`mimo-cut/`) 시안과 이음의 현재 사이트와는 별개로 새로 지은 시안이다.
지금은 첫 화면만 있다. 빌드 과정과 외부 라이브러리가 없다.

```sh
cd mimo-open && python3 -m http.server 8790   # http://localhost:8790
```

## 무엇이 되나

1. 닫힌 스토어 셔터가 화면을 채운다. 손가락이나 마우스로 위로 밀면 셔터가 손을 따라 올라간다.
2. 조금 올리고 손을 떼면 셔터가 끝까지 올라가고, 그 순간 음악과 함께 작품 다섯 편이 박자에 맞춰 컷으로 나온다.
3. 화면이 가게 안으로 들어가고, 쇼릴 끝에 제목이 박힌다.

버튼(위로 밀어 셔터 올리기), 마우스 휠, 키보드 위쪽 화살표로도 열 수 있다.

## 파일

| 파일 | 내용 |
| --- | --- |
| `index.html` `style.css` `app.js` | 첫 화면 |
| `assets/shutter/` | 셔터 프레임 99장(WebP, 720×1278), 치수 파일 `meta.js` |
| `assets/showreel.mp4` | 작품 다섯 편을 박자에 맞춰 자른 쇼릴(540×960, 약 14초, 음악 포함) |
| `assets/works/` | 작품 영상 5편(540×960). 쇼릴의 재료 |
| `source/shutter-draft-480p.mp4` | 셔터 원본. ZCRE Seedance 2.5 드래프트(480×854, 6초) |
| `source/shutter-1080p-bytedance.mp4` | 위 영상을 바이트댄스 업스케일 standard로 올린 것(1080×1918). 지금 사이트가 쓰는 원본 |
| `tools/build_shutter.py` | 셔터 영상을 프레임과 치수 파일로 바꾼다 |
| `tools/build_reel.py` | 작품 영상을 음악 박자에 맞춰 잘라 쇼릴을 만든다 |
| `fonts/` | Pretendard(한글 2,350자 + 라틴), Unbounded(로고). 둘 다 SIL OFL |

## 영상을 바꾸려면

- 쇼릴: `assets/works/`의 작품 파일을 바꾸고 `tools/build_reel.py`의 `SEGS`(작품, 시작 초, 박 수)를 고친 뒤 `python3 tools/build_reel.py 음악.mp3 효과음.wav`.
- 셔터: 새 영상으로 `python3 tools/build_shutter.py 새영상.mp4`. 카메라가 고정이고 셔터 뒤가 검게 나온 영상이어야 한다.
- 음악 파일은 저장소에 넣지 않는다. Epidemic Sound 커넥터로 그때 받는다.

## 색과 글

- 색: 자료방 「배색 레퍼런스」에서 골랐다. 글자 Cream `#F3EAD3`, 간판 Navy `#1D2A47`(B10 올드머니 5번), 포인트 Orange `#E77B2F`(B18 레트로 1번). 바탕 `#0E1524`는 네이비를 어둡게 한 값.
- 포인트 색은 낱말 하나(스토어, 광고)와 화살표에만 쓴다.
- 큰 글자는 한글, 간판과 작은 라벨은 영문.

## 소리

- 음악: Epidemic Sound 「Mojito」(AGST). 구독 계정으로 받았다. 쇼릴 영상에 들어 있다.
- 효과음: 미모 소리 창고의 `cinematic-impact.wav` 한 번(쇼릴 첫 박).
- 손으로 밀거나 버튼을 눌렀을 때만 소리가 난다. 소리 끄기 버튼이 항상 보인다.

## 지킨 것

- 한 화면에 주역은 셔터 하나. 지나가는 글자 띠 없음.
- `prefers-reduced-motion`이면 화면이 커지는 움직임 없이 바뀐다.
- 금액, 후기, 실적 표현 없음.
