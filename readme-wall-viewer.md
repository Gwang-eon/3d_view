# 옹벽 3D 뷰어 (Wall 3D Viewer)

<p align="center">
  <img src="https://img.shields.io/badge/Three.js-r128-black?style=for-the-badge&logo=three.js" alt="Three.js">
  <img src="https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License">
</p>

다양한 종류의 옹벽(블록식, 캔틸레버식, MSE) 3D 모델을 웹 브라우저에서 실시간으로 확인하고 분석할 수 있는 웹 기반 3D 뷰어 애플리케이션입니다.

## 🌟 주요 기능

- **🎮 3D 인터랙티브 뷰어**: 마우스로 모델을 자유롭게 회전, 확대/축소
- **📍 핫스팟 시스템**: 주요 부위에 대한 상세 정보 표시
- **🎬 애니메이션 재생**: 시공 순서, 하중 분포 등 다양한 애니메이션
- **📷 다중 카메라 뷰**: GLTF 파일 내장 카메라 지원
- **💡 실시간 조명 제어**: 밝기 및 조명 조절
- **📱 반응형 디자인**: 다양한 화면 크기 지원
- **🚀 플러그인 시스템**: 기능 확장 가능

## 🛠️ 기술 스택

- **3D 엔진**: Three.js r128
- **언어**: JavaScript ES6+
- **모듈 시스템**: ES Modules
- **3D 모델 포맷**: GLTF/GLB
- **스타일링**: CSS3 with CSS Variables
- **서버**: Node.js + Express (개발용)

## 📋 시스템 요구사항

- **브라우저**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **WebGL**: WebGL 2.0 지원 필수
- **Node.js**: 14.0+ (개발 서버 사용 시)

## 🚀 시작하기

### 1. 저장소 클론

```bash
git clone https://github.com/yourusername/wall-3d-viewer.git
cd wall-3d-viewer
```

### 2. 의존성 설치 (개발 서버 사용 시)

```bash
npm install
```

### 3. 실행 방법

#### 방법 1: 개발 서버 사용 (권장)
```bash
npm start
# 또는
node server.js
```
브라우저에서 `http://localhost:3000` 접속

#### 방법 2: Python 서버 사용
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

#### 방법 3: VS Code Live Server
VS Code의 Live Server 확장 프로그램 사용

#### 방법 4: 직접 파일 열기 (Windows)
```bash
start_viewer.bat
```

## 📁 프로젝트 구조

```
wall-3d-viewer/
├── index.html              # 메인 랜딩 페이지
├── viewer.html             # 3D 뷰어 페이지
├── css/
│   ├── main.css           # 기본 스타일
│   └── main-improved.css  # 개선된 UI 스타일
├── js/
│   ├── config.js          # 설정 파일
│   ├── main.js            # 메인 애플리케이션 (index.html용)
│   ├── viewer-main.js     # 뷰어 애플리케이션 (viewer.html용)
│   ├── viewer-init.js     # URL 파라미터 처리
│   ├── SceneManager.js    # Three.js 씬 관리
│   ├── ModelLoader.js     # GLTF 모델 로더
│   ├── UIController.js    # UI 컨트롤러
│   ├── HotspotManager.js  # 핫스팟 관리
│   ├── AnimationController.js # 애니메이션 제어
│   └── PluginSystem.js    # 플러그인 시스템
├── gltf/                  # 3D 모델 폴더
│   ├── Block_Retaining_Wall/
│   ├── Cantilever_Retaining_Wall/
│   └── mse_Retaining_Wall/
├── server.js              # 개발 서버
├── package.json           # npm 설정
└── README.md             # 이 파일
```

## 📖 사용법

### 기본 사용법

1. **모델 선택**: 메인 페이지에서 원하는 옹벽 모델 선택
2. **3D 뷰어 조작**:
   - 🖱️ **회전**: 마우스 왼쪽 버튼 드래그
   - 🔍 **확대/축소**: 마우스 휠 스크롤
   - ↔️ **이동**: 마우스 오른쪽 버튼 드래그
3. **핫스팟 확인**: 📍 아이콘 클릭하여 상세 정보 확인
4. **애니메이션 재생**: 하단 컨트롤바에서 ▶️ 버튼 클릭

### URL 파라미터

특정 모델을 직접 로드하려면:
```
viewer.html?model=0  # 블록 옹벽
viewer.html?model=1  # 캔틸레버 옹벽
viewer.html?model=2  # MSE 옹벽
```

### 모델 추가하기

1. `gltf/` 폴더에 새 하위 폴더 생성
2. GLTF/GLB 파일과 텍스처 추가
3. `js/config.js`에 모델 정보 추가:

```javascript
{
    name: '새 옹벽 모델',
    folder: 'new_wall_model',
    fileName: 'model.gltf',
    icon: '🏗️',
    description: '새로운 옹벽 구조'
}
```

4. (선택) 모델 폴더에 `info.json` 추가:

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

## 🎨 커스터마이징

### 설정 변경

`js/config.js`에서 다양한 설정 변경 가능:

```javascript
export const CONFIG = {
    // 카메라 설정
    camera: {
        fov: 75,
        position: { x: 10, y: 8, z: 15 }
    },
    // 조명 설정
    lights: {
        ambient: { intensity: 0.8 },
        directional: { intensity: 1.2 }
    },
    // 기타 설정...
};
```

### 플러그인 개발

새로운 기능을 플러그인으로 추가:

```javascript
import { Plugin } from './PluginSystem.js';

export class MyPlugin extends Plugin {
    constructor() {
        super('MyPlugin', '1.0.0');
    }
    
    async init(context) {
        await super.init(context);
        // 플러그인 초기화
    }
    
    createUI(container) {
        // UI 생성
    }
}
```

## 🔧 문제 해결

### 모델이 로드되지 않는 경우
- 브라우저 콘솔(F12)에서 오류 확인
- GLTF 파일 경로가 올바른지 확인
- CORS 정책 문제인 경우 로컬 서버 사용

### 성능 문제
- 모델의 폴리곤 수 최적화 (권장: 100만 미만)
- 텍스처 크기 축소 (권장: 2048x2048 이하)
- `config.js`에서 그림자 품질 조정

### WebGL 오류
- 브라우저가 WebGL을 지원하는지 확인
- 그래픽 드라이버 업데이트
- 하드웨어 가속 활성화 확인

## 🤝 기여하기

프로젝트 개선에 기여하고 싶으시다면:

1. Fork 하기
2. Feature 브랜치 생성 (`git checkout -b feature/AmazingFeature`)
3. 변경사항 커밋 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치에 Push (`git push origin feature/AmazingFeature`)
5. Pull Request 생성

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🙏 감사의 말

- [Three.js](https://threejs.org/) - 강력한 3D 라이브러리
- [GLTFLoader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader) - GLTF 모델 로딩
- 모든 기여자와 테스터분들

## 📞 연락처

프로젝트 관련 문의사항:
- 이슈 트래커: [GitHub Issues](https://github.com/yourusername/wall-3d-viewer/issues)
- 이메일: your.email@example.com

---

<p align="center">Made with ❤️ by [Your Name]</p>