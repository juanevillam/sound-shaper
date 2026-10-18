# Demo sounds

Six original tracks, about three minutes each, and their covers, made for the
App Store screenshots and for App Review's attachment. Nothing in them is
anyone else's: the audio is synthesized from code here (no samples, no loops)
and the covers are drawn procedurally, so the listing shows no third-party
content and the reviewer gets a file the app is allowed to hold.

| file             | style     |
| ---------------- | --------- |
| `Midnight Drive` | synthwave |
| `Tidal`          | lo-fi     |
| `Signal Fire`    | house     |
| `Glass Gardens`  | ambient   |
| `Copper Sun`     | dembow    |
| `Afterglow`      | downtempo |

All six credit "Juan Villa" and carry their cover as an embedded ID3 picture,
which is what the app reads on import. The reviewer's attachment is
`Midnight Drive.mp3`.

## Rebuilding them

Needs `numpy`, `scipy`, `pillow` and `ffmpeg`. The output is deterministic
(every random choice is seeded), so a rebuild gives the same files.

```bash
cd store/demo-audio && mkdir -p out
python3 compose.py   # out/<slug>.wav
python3 covers.py    # out/<slug>.jpg and out/contact.jpg
```

Then encode each at 192 kbps with its cover and tags, for example:

```bash
ffmpeg -i out/tidal.wav -i out/tidal.jpg -map 0:a -map 1:v -c:a libmp3lame -b:a 192k -c:v mjpeg -id3v2_version 3 -metadata title="Tidal" -metadata artist="Juan Villa" "Tidal.mp3"
```

`out/` and the MP3s are not committed; they are build output.
