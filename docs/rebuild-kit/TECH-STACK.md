# TECH-STACK — 패키지 · 스크립트 · 배포

원본 `package.json` name은 `text-styler-app`, version `2.4.0`, `"type": "module"`.

---

## 1. 의존성 (버전을 맞출 것)

```json
{
  "dependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "clsx": "^2.1.1",
    "file-saver": "^2.0.5",
    "gifenc": "^1.0.3",
    "jszip": "^3.10.1",
    "lucide-react": "^1.33.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "tailwindcss": "^4.3.3"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@playwright/test": "^1.62.1",
    "@testing-library/react": "^16.3.3",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.4",
    "canvas": "^3.2.3",
    "eslint": "^10.8.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.3",
    "globals": "^17.7.0",
    "playwright": "^1.62.1",
    "vite": "^8.2.0",
    "vitest": "^4.1.11"
  }
}
```

Playwright Chromium: `npx playwright install chromium`.  
네이티브 `canvas`는 loop-test가 샘플 시트를 그릴 때 필요.

---

## 2. npm scripts

```json
{
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run",
  "diagnose": "vitest run tests/autoRepair.test.js",
  "refresh": "node scripts/refresh-dev.js",
  "test:loop": "node scripts/loop-test.js",
  "verify": "npm run diagnose && npm run test:loop"
}
```

`deploy` 스크립트 없음. Pages는 `main` 푸시.

---

## 3. vite.config.js

- plugins: `@vitejs/plugin-react`, 루트 `/` → `/calligraphy-studio/` 302
- `base: '/calligraphy-studio/'`
- `server.port: 5173`
- `server.open: false`  (Vite가 창을 더 열지 않음)
- vitest: environment `node`, include `tests/**/*.test.{js,jsx}`

`refresh-dev.js`: LISTENING 5173 `taskkill` → `node_modules/.vite` · `.next/cache` · `node_modules/.cache` 삭제 → `vite --force --port 5173` → URL 응답 대기 → Windows 기본 브라우저 **기존 탭** 재사용. 콘솔에 `🧹 [캐시 삭제]` `🔄 [프로그램 재실행]` `🌐 [기본 브라우저 연결]`.

---

## 4. 필수 정적 파일

- `index.html` — React 마운트, 한글 lang
- `public/` 웹폰트 CSS/파일 (주아·도현·쿠키런 등 10선)
- `scripts/notify-primary.wav`, `scripts/notify-reminder.wav`
- `scripts/play-headset-sound.ps1` — PresentationCore MediaPlayer, Type primary|reminder
- E2E가 쓰는 캡처 경로: `public/test-result.png`, `test-result-grid.png`, `test-result-studio.png`, `test-result-pixel.png`

`.gitignore`: `node_modules`, `dist`, `.vscode/*` (extensions/settings/tasks는 예외 가능).

---

## 5. GitHub Pages

- Remote 예: `https://github.com/youlmacc-oss/calligraphy-studio.git`
- Pages URL: `https://youlmacc-oss.github.io/calligraphy-studio/`
- Workflow: Node 20, `npm ci --ignore-scripts || npm install --ignore-scripts`, `VITE_APP_BUILD=${{ github.sha }}`, artifact `./dist`
- 다른 계정에 재구축해도 `base`는 `/calligraphy-studio/`를 유지하거나, repo 이름에 맞춰 base와 리다이렉트를 **같이** 바꾼다. 둘 중 하나만 바꾸면 흰 화면.

---

## 6. 앱 빌드 표시

`src/lib/appBuild.js`:

```js
export const APP_BUILD = '2026.09.14-v2.4.1'
```

하단 엔진 칩과 진단 리포트에 찍힌다. 배포본 캐시 확인용.

---

## 7. 브라우저 API

- File System Access: `window.showSaveFilePicker`. `navigator.webdriver`면 쓰지 않고 `<a download>`.
- IndexedDB 세션 에셋
- `document.fonts.load`
- Worker: `gifEncodeWorker.js` (배치/구 경로). 단일 GIF 내보내기는 메인 스레드 gifenc.
- `createImageBitmap` 배경 다운스케일
