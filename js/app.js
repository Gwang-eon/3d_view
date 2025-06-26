// js/app.js - 메인 애플리케이션 컨트롤러 (CSS2DRenderer 핫스팟 통합)
import { Viewer3D } from './viewer.js';
import { ModelLoader } from './loader.js';
import { UIController } from './ui.js';
import { AnimationController } from './animation.js';
import { HotspotManagerV3 } from './hotspot-v3.js';

// 모델 설정 (실제 GitHub 경로)
const MODELS = [
    {
        name: '블록 옹벽',
        folder: 'Block_Retaining_Wall',
        fileName: 'Block_Retaining_Wall.gltf',
        icon: '🧱',
        description: '콘크리트 블록을 이용한 조립식 옹벽'
    },
    {
        name: '캔틸레버 옹벽',
        folder: 'Cantilever_Retaining_Wall',
        fileName: 'Cantilever_Retaining_Wall.gltf',
        icon: '🏗️',
        description: '철근 콘크리트 일체형 옹벽'
    },
    {
        name: 'MSE 옹벽',
        folder: 'mse_Retaining_Wall',
        fileName: 'mse_Retaining_Wall.gltf',
        icon: '🔧',
        description: '보강토 옹벽 (Mechanically Stabilized Earth)'
    }
];

// 애플리케이션 설정 - 밝기 조정
const CONFIG = {
    basePath: './gltf/',
    defaultModel: 0,
    viewer: {
        container: 'viewer',
        backgroundColor: 0x2a2a2a,  // 너무 어두운 0x1a1a1a에서 변경
        fog: {
            enabled: true,
            color: 0x2a2a2a,  // 안개 색상도 밝게
            near: 20,  // 10에서 증가
            far: 150   // 100에서 증가
        },
        showGrid: true,
        showAxes: false
    },
    camera: {
        fov: 45,
        near: 0.1,
        far: 1000,
        position: { x: 5, y: 5, z: 10 },
        lookAt: { x: 0, y: 0, z: 0 }
    },
    controls: {
        enableDamping: true,
        dampingFactor: 0.05,
        minDistance: 2,
        maxDistance: 100,  // 50에서 증가
        enablePan: true,
        panSpeed: 0.5
    },
    lights: {
        ambient: {
            color: 0xffffff,
            intensity: 0.8  // 0.6에서 증가
        },
        directional: {
            color: 0xffffff,
            intensity: 1.0,  // 0.8에서 증가
            position: { x: 10, y: 10, z: 5 },
            castShadow: true,
            shadowMapSize: 2048
        },
        point: {
            color: 0xffffff,
            intensity: 0.6,  // 0.4에서 증가
            position: { x: -5, y: 5, z: -5 }
        }
    },
    performance: {
        antialias: true,
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        shadowsEnabled: true
    }
};

/**
 * 옹벽 3D 뷰어 애플리케이션
 */
class WallViewerApp {
    constructor() {
        this.config = CONFIG;
        this.models = MODELS;
        this.currentModelIndex = 0;
        
        // 모듈
        this.viewer = null;
        this.loader = null;
        this.ui = null;
        this.animationController = null;
        this.hotspotManager = null;
        
        // 상태
        this.isLoading = false;
        this.isInitialized = false;
        
        // GLTF 카메라들
        this.gltfCameras = [];
        
        // 애니메이션용 시간 추적
        this.lastTime = 0;
    }
    
    /**
     * 애플리케이션 초기화
     */
    async init() {
        try {
            console.log('🚀 옹벽 3D 뷰어 시작...');
            
            // 환경 체크
            if (!this.checkEnvironment()) {
                throw new Error('WebGL을 지원하지 않는 브라우저입니다.');
            }
            
            // 모듈 초기화
            await this.initializeModules();
            
            // 이벤트 설정
            this.setupEventListeners();
            
            // URL 파라미터 확인
            this.handleURLParams();
            
            // 초기 모델 로드
            const initialModel = this.getInitialModelIndex();
            await this.loadModel(initialModel);
            
            this.isInitialized = true;
            console.log('✅ 초기화 완료');
            
        } catch (error) {
            console.error('❌ 초기화 실패:', error);
            this.handleFatalError(error);
        }
    }
    
    /**
     * WebGL 지원 확인
     */
    checkEnvironment() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        return !!gl;
    }
    
    /**
     * 모듈 초기화
     */
    async initializeModules() {
        // 3D 뷰어
        this.viewer = new Viewer3D(this.config);
        await this.viewer.init();
        
        // 모델 로더
        this.loader = new ModelLoader({
            basePath: this.config.basePath,
            loadingManager: this.viewer.loadingManager
        });
        
        // 애니메이션 컨트롤러
        this.animationController = new AnimationController(this.viewer);
        
        // 핫스팟 매니저 (CSS2DRenderer 버전)
        this.hotspotManager = new HotspotManagerV3(this.viewer);
        
        // 핫스팟 렌더링을 뷰어의 렌더링 루프에 추가 - 매 프레임마다 실행되도록
        this.viewer.addRenderCallback(() => {
            if (this.hotspotManager && this.hotspotManager.render) {
                this.hotspotManager.render();
            }
        });
        
        // 애니메이션 업데이트를 렌더링 루프에 추가 - 수정된 버전
        this.viewer.addRenderCallback(() => {
            if (this.animationController && this.animationController.mixer) {
                // 수동으로 delta 계산
                const currentTime = performance.now() / 1000; // 밀리초를 초로 변환
                const delta = currentTime - this.lastTime;
                this.lastTime = currentTime;
                
                // 첫 프레임이거나 너무 큰 delta는 무시
                if (delta > 0 && delta < 0.1) {
                    this.animationController.mixer.update(delta);
                }
            }
        });
        
        // UI 컨트롤러
        this.ui = new UIController({
            models: this.models,
            onModelSelect: (index) => this.loadModel(index),
            onViewChange: (view) => this.viewer.setView(view),
            onReset: () => this.viewer.resetCamera()
        });
        this.ui.init();
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 창 크기 변경
        window.addEventListener('resize', () => {
            this.viewer.handleResize();
            // CSS2DRenderer도 리사이즈
            if (this.hotspotManager && this.hotspotManager.cssRenderer) {
                this.hotspotManager.cssRenderer.setSize(window.innerWidth, window.innerHeight);
            }
        });
        
        // 전체화면 버튼
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }
        
        // 홈 버튼
        const homeBtn = document.getElementById('home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }
        
        // 카메라 선택
        const cameraSelect = document.getElementById('camera-select');
        if (cameraSelect) {
            cameraSelect.addEventListener('change', (e) => {
                this.switchCamera(e.target.value);
            });
        }
        
        // 키보드 단축키
        document.addEventListener('keydown', (e) => {
            this.handleKeyPress(e);
        });
        
        // 핫스팟 컨트롤
        this.setupHotspotControls();
    }
    
    /**
     * 핫스팟 컨트롤 설정
     */
    setupHotspotControls() {
        // 핫스팟 토글 버튼
        const toggleBtn = document.getElementById('toggle-hotspots');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.hotspotManager.toggleHotspots();
            });
        }
        
        // 스타일 선택
        const styleSelect = document.getElementById('hotspot-style');
        if (styleSelect) {
            styleSelect.addEventListener('change', (e) => {
                this.hotspotManager.setHotspotStyle(e.target.value);
            });
        }
        
        // 크기 선택
        const sizeSelect = document.getElementById('hotspot-size');
        if (sizeSelect) {
            sizeSelect.addEventListener('change', (e) => {
                this.hotspotManager.setHotspotSize(e.target.value);
            });
        }
        
        // 타입 필터
        const filterSelect = document.getElementById('hotspot-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.hotspotManager.filterByStatus(e.target.value);
            });
        }
    }
    
    /**
     * URL 파라미터 처리
     */
    handleURLParams() {
        const params = new URLSearchParams(window.location.search);
        const modelParam = params.get('model');
        
        if (modelParam !== null) {
            const index = parseInt(modelParam);
            if (!isNaN(index) && index >= 0 && index < this.models.length) {
                this.currentModelIndex = index;
            }
        }
    }
    
    /**
     * 초기 모델 인덱스 가져오기
     */
    getInitialModelIndex() {
        return this.currentModelIndex || this.config.defaultModel || 0;
    }
    
    /**
     * 모델 로드
     */
    async loadModel(index) {
        if (this.isLoading) return;
        
        if (index < 0 || index >= this.models.length) {
            console.error('잘못된 모델 인덱스:', index);
            return;
        }
        
        this.isLoading = true;
        this.currentModelIndex = index;
        const modelConfig = this.models[index];
        
        try {
            // UI 업데이트
            this.ui.showLoading();
            this.ui.setActiveModel(index);
            
            // 모델 경로 생성
            const modelPath = `${this.config.basePath}${modelConfig.folder}/${modelConfig.fileName}`;
            console.log(`📦 모델 로드: ${modelConfig.name}`);
            console.log(`📂 경로: ${modelPath}`);
            
            // 모델 로드
            const gltf = await this.loader.loadGLTF(modelPath);
            
            // 뷰어에 모델 설정
            this.viewer.setModel(gltf.scene);
            
            // GLTF 파일 내의 카메라 처리
            this.gltfCameras = [];  // 카메라 목록 초기화
            const cameraSelect = document.getElementById('camera-select');
            
            if (gltf.cameras && gltf.cameras.length > 0) {
                console.log(`📷 커스텀 카메라 ${gltf.cameras.length}개 발견`);
                
                // 카메라 목록 저장
                this.gltfCameras = gltf.cameras;
                
                // 카메라 선택 UI 업데이트
                if (cameraSelect) {
                    cameraSelect.innerHTML = '<option value="default">기본 카메라</option>';
                    
                    gltf.cameras.forEach((camera, index) => {
                        const cameraName = camera.name || `카메라 ${index + 1}`;
                        const option = document.createElement('option');
                        option.value = index;
                        option.textContent = cameraName;
                        cameraSelect.appendChild(option);
                    });
                    
                    // 첫 번째 커스텀 카메라 자동 선택
                    cameraSelect.value = '0';
                }
                
                // 첫 번째 카메라 적용
                this.applyCamera(gltf.cameras[0]);
                
            } else {
                console.log('📷 커스텀 카메라 없음 - 기본 카메라 사용');
                
                // 카메라 선택 UI 리셋
                if (cameraSelect) {
                    cameraSelect.innerHTML = '<option value="default">기본 카메라</option>';
                }
                
                // 기본 카메라 위치 조정
                this.viewer.adjustCameraToModel();
            }
            
            // 애니메이션 설정 - AnimationController의 별도 루프 제거됨
            if (gltf.animations && gltf.animations.length > 0) {
                this.animationController.setAnimations(gltf.animations, gltf.scene);
                // startUpdateLoop 호출 제거 - 메인 렌더 루프에서 처리
            }
            
            // 핫스팟 설정 (모델에서 추출)
            this.hotspotManager.extractHotspotsFromModel(gltf.scene);
            
            // UI 업데이트
            this.ui.hideLoading();
            this.ui.updateModelInfo(modelConfig);
            
            console.log(`✅ 모델 로드 완료: ${modelConfig.name}`);
            
        } catch (error) {
            console.error('❌ 모델 로드 실패:', error);
            this.ui.hideLoading();
            this.ui.showError(`모델을 로드할 수 없습니다: ${error.message}`);
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * 카메라 전환
     */
    switchCamera(cameraIndex) {
        if (cameraIndex === 'default') {
            // 기본 카메라로 전환
            this.viewer.resetCamera();
            this.viewer.adjustCameraToModel();
        } else {
            // 커스텀 카메라로 전환
            const index = parseInt(cameraIndex);
            if (this.gltfCameras[index]) {
                this.applyCamera(this.gltfCameras[index]);
            }
        }
    }
    
    /**
     * 카메라 적용
     */
    applyCamera(customCamera) {
        if (customCamera.isPerspectiveCamera) {
            // 기존 카메라의 속성을 업데이트
            this.viewer.camera.fov = customCamera.fov;
            this.viewer.camera.aspect = customCamera.aspect;
            this.viewer.camera.near = customCamera.near;
            this.viewer.camera.far = customCamera.far;
            
            // 카메라 위치와 회전 적용
            this.viewer.camera.position.copy(customCamera.position);
            this.viewer.camera.rotation.copy(customCamera.rotation);
            this.viewer.camera.quaternion.copy(customCamera.quaternion);
            
            // 투영 행렬 업데이트
            this.viewer.camera.updateProjectionMatrix();
            
            // 컨트롤 타겟 업데이트 (카메라가 바라보는 지점)
            const target = new THREE.Vector3();
            customCamera.getWorldDirection(target);
            target.multiplyScalar(10).add(customCamera.position);
            this.viewer.controls.target.copy(target);
            this.viewer.controls.update();
            
            console.log('✅ 카메라 적용됨:', customCamera.name || '이름 없음');
        }
    }
    
    /**
     * 키보드 단축키 처리
     */
    handleKeyPress(event) {
        // 숫자 키로 모델 선택
        if (event.key >= '1' && event.key <= '3') {
            const index = parseInt(event.key) - 1;
            if (index < this.models.length) {
                this.loadModel(index);
            }
        }
        
        // 단축키
        switch(event.key) {
            case 'f':
            case 'F':
                this.toggleFullscreen();
                break;
            case 'r':
            case 'R':
                this.viewer.resetCamera();
                break;
            case 'g':
            case 'G':
                this.viewer.toggleGrid();
                break;
            case 'h':
            case 'H':
                // 핫스팟 토글
                this.hotspotManager.toggleHotspots();
                break;
            case ' ':
                // 스페이스바로 애니메이션 재생/일시정지
                if (this.animationController) {
                    this.animationController.togglePlayPause();
                }
                event.preventDefault();
                break;
            case 'Escape':
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                }
                break;
        }
    }
    
    /**
     * 전체화면 토글
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
    
    /**
     * 치명적 에러 처리
     */
    handleFatalError(error) {
        console.error('치명적 에러:', error);
        
        const errorScreen = document.getElementById('error');
        const errorMessage = document.getElementById('error-message');
        
        if (errorMessage) {
            errorMessage.textContent = error.message || '알 수 없는 오류가 발생했습니다.';
        }
        
        if (errorScreen) {
            errorScreen.style.display = 'flex';
        }
        
        // 로딩 화면 숨기기
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }
}

// 애플리케이션 시작
document.addEventListener('DOMContentLoaded', async () => {
    const app = new WallViewerApp();
    
    try {
        await app.init();
        
        // 전역 접근 (디버깅용)
        window.wallViewerApp = app;
        
    } catch (error) {
        console.error('애플리케이션 시작 실패:', error);
    }
});