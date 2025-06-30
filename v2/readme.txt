# 옹벽 3D 뷰어 v2.0

## 🎯 개요

옹벽 3D 뷰어의 완전히 새로워진 버전입니다. 기존의 복잡하고 파편화된 구조를 간소화하여 **단일 통합 클래스**로 구현했습니다.

## 🆚 v1 vs v2 비교

| 항목 | v1 (기존) | v2 (새버전) |
|------|-----------|-------------|
| **파일 수** | 15+ 개 | 5개 |
| **설정 관리** | 여러 파일에 분산 | config.json 통합 |
| **의존성** | 복잡한 import 구조 | 단순화 |
| **유지보수** | 어려움 | 쉬움 |
| **코드량** | ~2000+ 라인 | ~800 라인 |
| **하드코딩** | 많음 | 제거됨 |

## 📁 폴더 구조

```
v2/
├── index.html              # 홈페이지
├── viewer.html             # 메인 뷰어
├── config.json             # 통합 설정 파일
│
├── assets/
│   └── styles/
│       └── main.css        # 통합 스타일시트
│
├── src/
│   └── WallViewer.js       # 메인 통합 클래스
│
└── README.md              # 이 파일
```

## ⚙️ 설정 시스템

모든 설정이 `config.json`에 통합되어 있습니다:

```json
{
  "app": { ... },           // 앱 기본 설정
  "models": [ ... ],        // 모델 정보
  "viewer": { ... },        // 뷰어 설정
  "camera": { ... },        // 카메라 설정
  "lights": { ... },        // 조명 설정
  "hotspots": { ... },      // 핫스팟 설정
  "animation": { ... }      // 애니메이션 설정
}
```

## 🚀 실행 방법

### 1. 파일 준비
```bash
# v2 폴더에 모든 파일이 있는지 확인
v2/
├── index.html
├── viewer.html  
├── config.json
├── assets/styles/main.css
└── src/WallViewer.js
```

### 2. 웹 서버 실행
```bash
# Python 3 사용
python -m http.server 8000

# Node.js 사용  
npx http-server

# VS Code Live Server 확장 사용
```

### 3. 브라우저에서 접속
```
http://localhost:8000/v2/
```

## 🎮 사용법

### 기본 조작
- **마우스 드래그**: 모델 회전
- **마우스 휠**: 줌 인/아웃
- **우클릭 드래그**: 패닝

### 키보드 단축키
- `스페이스바`: 애니메이션 재생/일시정지
- `R`: 카메라 리셋
- `G`: 그리드 토글
- `H`: 핫스팟 토글
- `1/2/3`: 모델 전환

### URL 파라미터
```
viewer.html?model=0  # 블록 옹벽
viewer.html?model=1  # 캔틸레버 옹벽
viewer.html?model=2  # MSE 옹벽
```

## 🔧 커스터마이징

### 1. 새 모델 추가
`config.json`의 `models` 배열에 추가:

```json
{
  "id": "new_model",
  "name": "새 모델",
  "folder": "New_Model_Folder",
  "fileName": "model.gltf",
  "icon": "🏗️",
  "description": "설명",
  "animation": {
    "startFrame": 1,
    "crackFrame": 30,
    "fps": 30
  }
}
```

### 2. 스타일 변경
`assets/styles/main.css`의 CSS 변수 수정:

```css
:root {
  --primary-bg: #1a1a1a;      /* 배경색 */
  --accent-color: #007bff;     /* 액센트 색상 */
  --text-primary: #ffffff;     /* 주 텍스트 색상 */
}
```

### 3. 카메라 설정 조정
`config.json`에서 모델별 카메라 위치 설정:

```json
"camera": {
  "position": [5, 5, 10],
  "lookAt": [0, 0, 0]
}
```

## 🎯 핵심 기능

### WallViewer 클래스
모든 기능이 하나의 클래스에 통합:

```javascript
const viewer = new WallViewer(config);
await viewer.init();

// 모델 로드
await viewer.loadModel(1);

// 애니메이션 제어
viewer.playAnimation();
viewer.pauseAnimation();

// 카메라 제어  
viewer.resetCamera();
viewer.setView('front');
```

### 설정 기반 구동
하드코딩 없이 JSON 설정으로 모든 것을 제어:

```javascript
// 설정 로드
const config = await fetch('./config.json').then(r => r.json());
const viewer = new WallViewer(config);
```

## 🐛 트러블슈팅

### 모델이 로드되지 않음
1. GLTF 파일 경로 확인
2. `config.json`의 `basePath` 설정 확인
3. 브라우저 콘솔에서 에러 메시지 확인

### 애니메이션이 작동하지 않음
1. GLTF 파일에 애니메이션이 포함되어 있는지 확인
2. `config.json`의 애니메이션 설정 확인

### CORS 에러 발생
- 웹 서버를 통해 접속 (file:// 직접 접근 불가)
- Chrome의 경우 `--disable-web-security` 플래그 사용

## 🔄 v1에서 v2로 마이그레이션

### 1. 설정 이전
기존 하드코딩된 설정을 `config.json`으로 이전

### 2. 기능 매핑
- `app.js` → `WallViewer.js`
- `viewer.js` + `loader.js` + `animation.js` → `WallViewer.js`
- `css/` → `assets/styles/main.css`

### 3. 검증
모든 기능이 정상 작동하는지 확인

## 📈 성능 최적화

### 모델 캐싱
```javascript
// 자동 캐싱 시스템
this.modelCache = new Map();
```

### 리소스 관리
```javascript
// 모델 전환 시 자동 정리
clearCurrentModel() {
  // 메모리 정리 로직
}
```

## 🛠️ 개발자 가이드

### 디버깅
```javascript
// 전역 접근 (브라우저 콘솔에서)
window.wallViewer.loadModel(1);
window.wallViewer.playAnimation();
```

### 확장
새 기능 추가 시 `WallViewer` 클래스에 메서드 추가:

```javascript
// WallViewer.js에 추가
newFeature() {
  console.log('새 기능 실행');
}
```

## 📋 TODO

- [ ] 센서 차트 시스템 구현
- [ ] 고급 핫스팟 시스템
- [ ] 모바일 최적화
- [ ] PWA 지원
- [ ] 다국어 지원

## 🆘 지원

문제 발생 시:
1. 브라우저 콘솔 확인
2. `config.json` 유효성 검사
3. Three.js 버전 호환성 확인

---

**옹벽 3D 뷰어 v2.0** - 심플하고 강력한 3D 모델 뷰어