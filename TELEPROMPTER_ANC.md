# Teleprompter আর ANC mode

## Teleprompter

রেকর্ডিংয়ের সময় script পড়ার জন্য একটা ভাসমান window। এটা সবসময় অন্য window-এর উপরে থাকে, কিন্তু **রেকর্ডিংয়ে দেখা যায় না** (Windows 10 version 2004 বা নতুন, আর macOS-এ)।

**খোলা:** HUD-এ টাইমার বোতামের পাশে নতুন **script আইকন** চাপুন। আবার চাপলে বন্ধ হবে।

**ব্যবহার:**
1. প্রথমবার খুললে script লেখার জায়গা আসে। Script paste বা type করুন। ফাঁকা লাইন দিলে নতুন paragraph হয়। বাংলা আর ইংরেজি দুটোই চলে।
2. **Start reading** চাপুন।
3. **Start with recording** চালু থাকলে রেকর্ডিং শুরু হলেই লেখা নিজে থেকে চলতে শুরু করে, আর রেকর্ডিং থামলে থেমে যায়।
4. **হলুদ দাগ (cue line)** যেখানে, সেখানকার লাইনটা পড়ুন। পড়া হয়ে যাওয়া লেখা উপরে গিয়ে ঝাপসা হয়ে যায়।

Window-টা উপরের মাঝখানে খোলে, webcam-এর কাছাকাছি, যাতে পড়ার সময় চোখ ক্যামেরার দিকে থাকে। টেনে সরানো আর resize করা যায়, পরের বার আগের জায়গাতেই খুলবে।

**কন্ট্রোল:**

| কাজ | বোতাম | Keyboard |
|---|---|---|
| চালু / থামানো | ▶ | Space |
| গতি বাড়ানো / কমানো (words per minute) | − / + | ↑ / ↓ |
| লেখা বড় / ছোট | A / A | + / − |
| শুরুতে ফেরা | Restart | R |
| Mirror (beam-splitter teleprompter rig-এর জন্য) | ⇋ | M |
| Script edit | Edit script | E |
| থামানো | | Esc |

- Mouse wheel দিয়ে হাতে আগে-পিছে করা যায়।
- কোনো paragraph-এ double-click করলে সেটা cue line-এ চলে আসে।
- গতি words-per-minute-এ, তাই লেখা বড়-ছোট করলেও পড়ার গতি একই থাকে। উপরে কত সময় বাকি তাও দেখায়।
- লেখা চলার সময় নিচের কন্ট্রোল লুকিয়ে যায়, mouse নাড়ালে ফিরে আসে।
- Script আর setting নিজে থেকেই save হয়।

**Linux:** Linux-এ window লুকানোর ব্যবস্থা নেই, তাই teleprompter রেকর্ডিংয়ে দেখা যাবে। সেক্ষেত্রে যে screen রেকর্ড হচ্ছে না, সেখানে রাখুন।

## ANC mode (Noise cancellation)

মাইকের আওয়াজ থেকে পাখা, AC, hum, hiss, রাস্তার শব্দের মতো background noise কমায়।

**চালু করা:** HUD-এ **মাইক আইকন** চাপুন। মাইক চালু থাকলে নিচে **Noise cancellation (ANC)** অংশে level বেছে নিন:

- **Off:** কোনো পরিবর্তন নেই (default)
- **Light:** পাখা, hum, hiss। কণ্ঠ একদম স্বাভাবিক থাকে।
- **Strong:** বেশি শব্দের ঘর, রাস্তার আওয়াজ। কথার ফাঁকে noise আরও কমায়।

**কীভাবে কাজ করে:** রেকর্ডিং থামানোর পরপরই মাইকের track পরিষ্কার করা হয় (FFmpeg-এর highpass, afftdn noise reduction, আর Strong-এ noise gate দিয়ে)। রেকর্ডিং চলার সময় কোনো বাড়তি চাপ পড়ে না, তাই দুর্বল PC-তেও সমস্যা হয় না। ভিডিওর সাথে sync ঠিক থাকে। কোনো কারণে প্রক্রিয়া ব্যর্থ হলে আসল আওয়াজ অপরিবর্তিত থাকে।

পরীক্ষায় শুধু background noise-এ: Light প্রায় ৬ dB আর Strong প্রায় ২৩ dB কমিয়েছে।

শুধু মাইকের track-এ কাজ করে, system audio (কম্পিউটারের নিজের শব্দ) অপরিবর্তিত থাকে।

## পরিবর্তিত ফাইল

- `electron/teleprompterWindow.ts` *(নতুন)*: teleprompter window, capture থেকে লুকানো, রেকর্ডিংয়ের সাথে sync
- `src/components/teleprompter/` *(নতুন)*: teleprompter UI, logic, tests
- `src/assets/fonts/atkinson-hyperlegible/`, `noto-sans-bengali/` *(নতুন)*: সহজে পড়ার মতো font আর বাংলা font (OFL license)
- `src/lib/noiseCancellation.ts`, `electron/ipc/recording/noiseCancellation.ts` *(নতুন)*: ANC
- `electron/ipc/recording/windows.ts`, `mac.ts`, `electron/ipc/register/recording.ts`: তিনটা মাইক পথেই ANC
- `src/components/launch/popovers/MicPopover.tsx`: ANC level বাছাই
- `src/components/launch/LaunchWindow.tsx`: HUD-এ teleprompter বোতাম
- `electron/main.ts`, `windows.ts`, `preload.ts`, `electron-env.d.ts`, `src/App.tsx`, `src/components/ui/icons.tsx`: সংযোগ
