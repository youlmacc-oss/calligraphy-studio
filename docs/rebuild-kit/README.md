# Calligraphy Studio 재현 키트 (v2.4.0)

이 폴더만 다른 PC·다른 Cursor 워크스페이스에 복사하면, **코드 없이 MD만으로** 동일한 웹 앱을 다시 만들 수 있다.

기준 빌드: `2026.09.14-v2.4.1` (기능 명세는 v2.4.0 + HQ GIF=내보내기 동일 경로)  
제품명: **Calligraphy Studio / AI Motion GIF Studio PRO**  
로컬 URL: `http://localhost:5173/calligraphy-studio/`  
배포 URL: `https://youlmacc-oss.github.io/calligraphy-studio/`  
배포 ZIP: `docs/Calligraphy-Studio-Rebuild-Kit-v2.4.1.zip` (이 폴더 + 루트 프로토콜 + GUIDEBOOK)

구버전 초안(`docs/MOTION_GIF_STUDIO_*.md`)은 5프리셋·샌드박스 시절 문서다. **이 폴더가 우선**이다.

---

## 읽는 순서 (에이전트·개발자 공통)

1. [`PROMPTS.md`](./PROMPTS.md) — 새 채팅에 그대로 붙여 넣을 마스터 프롬프트와 불변 규약
2. [`PRD.md`](./PRD.md) — 무엇을 만드는가 (기능·수용 기준)
3. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — 어떻게 연결되는가 (모듈·파이프라인)
4. [`UI.md`](./UI.md) — 화면을 어떻게 그리는가 (레이아웃 동결 포함)
5. [`ENGINE-LOCK.md`](./ENGINE-LOCK.md) — 다시 짜면 안 되는 공식
6. [`TECH-STACK.md`](./TECH-STACK.md) — 패키지·스크립트·배포
7. [`ACCEPTANCE.md`](./ACCEPTANCE.md) — 100% 동일하다고 판정하는 방법

프로젝트 루트의 `UNIVERSAL_PROTOCOL.md`, `ALL_IN_ONE_PROTOCOL.md`, `.cursorrules`도 같이 복사한다.

---

## 한 줄 제품 정의

브라우저만 쓰는 **서예/키치 텍스트 스타일러 + 이모티콘 시트 분할기 + 360 모션 GIF/WebP 스튜디오**. 서버 인코딩 없음. 메인 3단 레이아웃은 100% 동결이다.
