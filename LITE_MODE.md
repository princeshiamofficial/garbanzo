# Recordly Ultra Lite Mode

দুর্বল PC-র (২–৪ GB RAM, dual-core CPU, integrated graphics) জন্য Recordly-র একটা হালকা প্রোফাইল। সব feature আগের মতোই আছে (auto-zoom, cursor effect, background, webcam, annotation, export)। শুধু মান আর গতির ভারসাম্য দুর্বল PC-র মতো করে সাজানো।

## কীভাবে চালু হয়

- **Auto (default):** PC-তে ৪ GB বা তার কম RAM, অথবা ২টা বা তার কম CPU thread থাকলে নিজে থেকেই চালু হয়।
- **হাতে চালু/বন্ধ:** Dashboard → **Settings → Recording → "Ultra Lite mode (low-spec PCs)"**।
- পরিবর্তনের পর Recordly একবার restart করুন। রেকর্ডিংয়ের setting পরের রেকর্ডিং থেকেই কাজ করে, আর preview ও memory-র setting restart-এর পর পুরোপুরি কাজ করে।

## Lite mode-এ যা বদলায়

| অংশ | সাধারণ | Ultra Lite |
|---|---|---|
| স্ক্রিন রেকর্ডিং | সর্বোচ্চ 4K, 60 FPS, 30–76 Mbps | সর্বোচ্চ 1080p, 30 FPS, 6 Mbps |
| Native recorder (Windows WGC / macOS) | 60 FPS | 30 FPS (bitrate নিজে থেকে কমে) |
| Webcam | 720p, 30 FPS, 8 Mbps | 480p, 24 FPS, 1.5 Mbps |
| Editor preview | 60 FPS, পুরো screen resolution, antialias, blur | 30 FPS, 1x resolution, antialias বন্ধ, preview-তে blur বন্ধ |
| Export memory | মেমরিতে ৩৬–১৮০টা frame | মেমরিতে ৪–৮টা frame |
| Export default | Source quality, Balanced | Good quality (প্রায় 810p), Fast |
| Electron | — | Renderer heap ১ GB-এ সীমিত, অপ্রয়োজনীয় Chromium feature বন্ধ |

Motion blur শুধু **preview**-তে বন্ধ থাকে। Export করা ভিডিওতে আগের মতোই থাকে।

### Hardware encoder (game recorder-এর কৌশল)

Recordly আগে থেকেই game recorder-এর মতো GPU-র hardware encoder ব্যবহার করে। Windows-এ Media Foundation hardware transform (Intel QuickSync / NVIDIA NVENC / AMD AMF), আর export-এ WebCodecs `prefer-hardware`। হার্ডওয়্যার সাপোর্ট না থাকলে নিজে থেকেই software encoder-এ চলে যায়। Lite mode এর সাথে frame rate আর resolution কমিয়ে encoder-এর চাপ আরও কমায়।

## পরিবর্তিত ফাইল

- `src/lib/liteMode.ts` *(নতুন)*: প্রোফাইল, auto-detect, setting
- `src/lib/liteMode.test.ts` *(নতুন)*: tests
- `electron/liteModeMain.ts` *(নতুন)*: main process-এ RAM/CPU detect
- `electron/main.ts`: Lite mode-এর Chromium switch
- `electron/ipc/register/recording.ts`: native recorder-এর FPS
- `src/hooks/useScreenRecorder.ts`: রেকর্ডিং resolution, FPS, bitrate, webcam
- `src/components/video-editor/VideoPlayback.tsx`: preview FPS, resolution, antialias, blur
- `src/lib/exporter/exportTuning.ts`, `forwardFrameSource.ts`, `streamingDecoder.ts`: low-memory export
- `src/components/video-editor/exportPreferences.ts`: Lite export default
- `src/components/video-editor/dashboard/DashboardSettings.tsx`: Settings-এ toggle
- `.github/workflows/build.yml`: attestation step ব্যর্থ হলেও build চলবে

পুরো পরিবর্তন দেখতে `ultra-lite-mode.patch` দেখুন, অথবা repo-তে `git log -p -1` চালান।

## Build (Windows installer)

Windows-এর native অংশ (WGC capture helper) Windows-এ build করতে হয়।

**পথ ১: নিজের Windows PC-তে**

1. Node.js 22+, Git, আর Visual Studio 2022 Build Tools ("Desktop development with C++" + CMake) install করুন।
2. এই folder-এ:
   ```
   npm install
   npm run build:win
   ```
3. Installer পাবেন `release/` folder-এ।

**পথ ২: GitHub Actions (Windows PC ছাড়া)**

1. GitHub-এ নতুন repo বানিয়ে এই folder push করুন।
2. Repo-তে আগে থেকেই `.github/workflows/build.yml` আছে। **Actions** tab থেকে workflow চালান আর Windows build-এর artifact download করুন।

## পরীক্ষা

```
npm run typecheck
npx vitest --run src/lib/liteMode.test.ts src/lib/exporter/exportTuning.test.ts
```

## License

Recordly **AGPL-3.0**। এই modified version client-কে দিলে source code-ও (এই পরিবর্তনসহ) public রাখতে বা client-কে দিতে হবে। Public GitHub repo রাখলেই এটা পূরণ হয়।

## বাস্তব প্রত্যাশা (২ GB RAM)

- ৩–৫ মিনিটের রেকর্ডিং আর সাধারণ editing ভালো চলা উচিত।
- Export ধীর হবে, কিন্তু মেমরি কম লাগবে বলে crash-এর ঝুঁকি অনেক কম।
- কাজের সময় Chrome বা অন্য ভারী app বন্ধ রাখুন।
- ৪–৮ GB RAM আর SSD-তে upgrade করলে সবচেয়ে বেশি উন্নতি হবে।
