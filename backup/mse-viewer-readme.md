# 옹벽 3D 뷰어 - Wall 3D Viewer

다양한 종류의 옹벽(블록식, 캔틸레버식, MSE) 3D 모델을 위한 웹 기반 뷰어 시스템입니다. GLTF 형식의 3D 모델을 로드하고, 애니메이션을 재생하며, Hotspot을 통한 상호작용이 가능합니다.

## 주요 기능

- 📁 **모듈화된 구조**: 각 기능이 독립적인 모듈로 분리되어 유지보수가 용이
- 🔍 **자동 모델 감지**: gltf 폴더 내의 모델을 자동으로 스캔
- 🎬 **애니메이션 지원**: GLTF 애니메이션 재생 및 제어
- 📍 **Hotspot 시스템**: 3D 공간에 인터랙티브 마커 배치
- 📷 **다중 카메라**: GLTF 파일 내의 카메라 지원
- 🎮 **직관적인 컨트롤**: OrbitControls를 통한 부드러운 카메라 조작

## 폴더 구조

```
wall-3d-viewer/
├── index.html              # 메인 HTML 파일
├── css/
│   └── main.css           # 스타일시트
├── js/
│   ├── config.js          # 설정 파일
│   ├── ModelLoader.js     # 모델 로더 모듈
│   ├── SceneManager.js    # 씬 관리 모듈
│   ├── UIController.js    # UI 컨트롤러
│   ├── HotspotManager.js  # Hotspot 관리
│   ├── AnimationController.js # 애니메이션 제어
│   └── main.js            # 메인 애플리케이션
├── gltf/                  # GLTF 모델 폴더
│   ├── Block_Retaining_Wall/
│   ├── Cantilever_Rataining_Wall/
│   └── mse_Retaining_Wall/
├── server.js              # 개발 서버 (선택사항)
├── package.json           # npm 패키지 설정
└── README.md             # 이 파일
```

## 설치 및 실행

### 방법 1: 정적 파일로 실행 (서버 없이)

1. 모든 파일을 웹 서버에 업로드
2. `js/config.js` 파일에서 모델 목록을 수동으로 설정:

```javascript
models: [
    {
        name: 'MSE 옹벽 기본 모델',
        folder: 'mse_wall_basic',
        icon: '🏗️',
        description: '표준 MSE 옹벽 구조'
    },
    // 추가 모델...
]
```

3. 브라우저에서 `index.html` 열기

### 방법 2: 개발 서버 사용 (자동 폴더 스캔)

1. Node.js 설치 필요
2. 의존성 설치:
```bash
npm install
```

3. 서버 실행:
```bash
npm start
```

4. 브라우저에서 `http://localhost:3000` 접속

## GLTF 모델 추가

1. `gltf/` 폴더에 새 하위 폴더 생성
2. GLTF/GLB 파일과 관련 리소스(텍스처, bin 파일) 추가
3. (선택사항) `info.json` 파일 추가로 모델 정보 커스터마이즈:

```json
{
    "name": "커스텀 모델 이름",
    "icon": "🏗️",
    "description": "모델 설명",
    "metadata": {
        "version": "1.0",
        "author": "제작자"
    }
}
```

## Hotspot 설정

GLTF 모델 내의 오브젝트 이름이 `HS_`로 시작하면 자동으로 Hotspot으로 인식됩니다.

Blender 등에서 설정 방법:
1. 오브젝트 이름을 `HS_포인트1` 형식으로 지정
2. Custom Properties에 추가 정보 설정 가능

## 커스터마이징

### 설정 변경
`js/config.js` 파일에서 다양한 설정 변경 가능:
- 카메라 초기 위치
- 조명 설정
- 렌더링 옵션
- UI 표시 옵션

### 스타일 변경
`css/main.css` 파일에서 UI 스타일 커스터마이즈

### 기능 확장
모듈화된 구조로 새로운 기능 추가가 용이:
- 새 모듈 생성 후 `main.js`에서 초기화
- 기존 모듈 확장 가능

## 브라우저 지원

- Chrome (권장)
- Firefox
- Safari
- Edge

WebGL을 지원하는 모든 최신 브라우저에서 동작합니다.

## 문제 해결

### 모델이 로드되지 않는 경우
- 브라우저 콘솔에서 오류 메시지 확인
- GLTF 파일 경로가 올바른지 확인
- CORS 정책으로 인한 문제인 경우 서버 사용

### 성능 문제
- 모델의 폴리곤 수 최적화
- 텍스처 크기 축소
- `config.js`에서 그림자 품질 조정

## 라이선스

MIT License