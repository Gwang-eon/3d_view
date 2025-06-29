// js/app.js - 메인 애플리케이션 컨트롤러 (최소 수정 버전)

import { Viewer3D } from './viewer.js';
import { ProgressiveLoader, LOADING_MESSAGES } from './progressive-loader.js';
import { loadingUI } from './loading-ui.js';
import { UIController } from './ui.js';
import { SensorAnimationController } from './sensor-animation.js';
import { HotspotSpriteManager } from './hotspot-sprite.js';
import { SensorChartManager } from './sensor-chart.js';

// 모델 설정 (기존과 동일)
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

// 애플리케이션 설정 (기존과 동일)
const CONFIG = {
    basePath: './gltf/',
    defaultModel: 0,
    viewer: {
        container: 'viewer',
        backgroundColor: 0x2a2a2a,
        fog: {
            enabled: true,
            color: 0x2a2a2a,
            near: 20,
            far: 150
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
        dampingFactor: 0.15,
        minDistance: 2,
        maxDistance: 100,
        enablePan: true,
        panSpeed: 0.5,
        rotateSpeed: 0.5,
        zoomSpeed: 0.8,
        minPolarAngle: 0,
        maxPolarAngle: Math.PI * 0.9
    },
    lights: {
        ambient: {
            color: 0xffffff,
            intensity: 0.8
        },
        directional: {
            color: 0xffffff,
            intensity: 1.0,
            position: { x: 10, y: 10, z: 5 },
            castShadow: true,
            shadowMapSize: 2048
        },
        point: {
            color: 0xffffff,
            intensity: 0.6,
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
 * 옹벽 3D 뷰어 애플리케이션 (최소 수정 버전)
 */
export class WallViewerApp {
    constructor() {
        this.config = CONFIG;
        this.models = MODELS;
        
        // 모듈 인스턴스
        this.viewer = null;
        this.progressiveLoader = null;
        this.ui = null;
        this.animationController = null;
        this.hotspotManager = null;
        this.chartManager = null;
        
        // 상태 관리
        this.state = {
            isLoading: false,
            isInitialized: false,
            currentModelIndex: null,
            hasError: false,
            errorMessage: null
        };
        
        // 데이터
        this.currentHotspotData = null;
        this.gltfCameras = [];
        
        // 초기화 프로미스 (중복 초기화 방지)
        this.initPromise = null;
        
        // 초기화 시작
        this.init();
    }
    
    /**
     * 애플리케이션 초기화 (기존 로직 유지)
     */
    async init() {
        // 이미 초기화 중이거나 완료된 경우 기존 프로미스 반환
        if (this.initPromise) {
            return this.initPromise;
        }
        
        this.initPromise = this._performInit();
        return this.initPromise;
    }
    
    /**
     * 실제 초기화 수행 (기존 로직 유지)
     */
    async _performInit() {
        try {
            console.log('🚀 3D 뷰어 초기화 시작...');
            
            // 1단계: URL 파라미터 처리
            this.handleURLParams();
            console.log('✅ URL 파라미터 처리 완료');
            
            // 2단계: 핵심 모듈 초기화
            await this.initializeModules();
            console.log('✅ 모든 모듈 초기화 완료');
            
            // 3단계: 이벤트 리스너 설정
            this.setupEventListeners();
            console.log('✅ 이벤트 리스너 설정 완료');
            
            // 4단계: UI 상태 동기화
            this.syncUIState();
            console.log('✅ UI 상태 동기화 완료');
            
            // 5단계: 초기 모델 로드
            await this.loadInitialModel();
            console.log('✅ 초기 모델 로드 완료');
            
            this.state.isInitialized = true;
            console.log('✅ 3D 뷰어 초기화 완료!');
            
        } catch (error) {
            this.handleInitializationError(error);
            throw error;
        }
    }
    
    /**
     * 모듈 초기화 (기존 버전 유지)
     */
    async initializeModules() {
        console.log('📌 모듈 초기화 시작...');
        
        const initSteps = [
            {
                name: '3D 뷰어',
                init: async () => {
                    this.viewer = new Viewer3D(this.config);
                    this.viewer.app = this; // 상호 참조
                    await this.viewer.init();
                }
            },
            {
                name: '프로그레시브 로더',
                init: async () => {
                    this.progressiveLoader = new ProgressiveLoader({
                        basePath: this.config.basePath,
                        loadingManager: this.viewer.loadingManager,
                        onStateChange: (state) => {
                            console.log(`📊 로딩 상태: ${state}`);
                            loadingUI.updateState(state);
                        },
                        onProgress: (progress) => {
                            loadingUI.updateProgress(progress);
                        }
                    });
                }
            },
            {
                name: '애니메이션 컨트롤러',
                init: async () => {
                    this.animationController = new SensorAnimationController(this.viewer);
                }
            },
            {
                name: '핫스팟 매니저',
                init: async () => {
                    this.hotspotManager = new HotspotSpriteManager(this.viewer);
                }
            },
            {
                name: 'UI 컨트롤러',
                init: async () => {
                    this.ui = new UIController({
                        models: this.models,
                        onModelSelect: (index) => this.loadModel(index),
                        onViewChange: (view) => this.viewer.setView(view),
                        onReset: () => this.viewer.resetCamera()
                    });
                    this.ui.init();
                    
                    // UI 메서드 확장 (누락된 기능 추가)
                    this.extendUIController();
                }
            },
            {
                name: '센서 차트 매니저',
                init: async () => {
                    this.chartManager = new SensorChartManager();
                }
            }
        ];
        
        // 순차적 모듈 초기화
        for (const step of initSteps) {
            try {
                await step.init();
                console.log(`✅ ${step.name} 초기화 완료`);
            } catch (error) {
                console.error(`❌ ${step.name} 초기화 실패:`, error);
                throw new Error(`${step.name} 초기화 실패: ${error.message}`);
            }
        }
    }
    
    /**
     * UI 컨트롤러 기능 확장 (기존 로직 유지)
     */
    extendUIController() {
        // 카메라 박스 제어
        if (!this.ui.showCameraBox) {
            this.ui.showCameraBox = () => {
                const cameraBox = document.getElementById('camera-floating') || this.ui.elements.cameraBox;
                if (cameraBox) {
                    cameraBox.classList.add('show');
                }
            };
        }
        
        if (!this.ui.hideCameraBox) {
            this.ui.hideCameraBox = () => {
                const cameraBox = document.getElementById('camera-floating') || this.ui.elements.cameraBox;
                if (cameraBox) {
                    cameraBox.classList.remove('show');
                }
            };
        }
    }
    
    /**
     * 이벤트 리스너 설정 (기존 로직 유지)
     */
    setupEventListeners() {
        // 창 크기 변경
        window.addEventListener('resize', () => {
            if (this.viewer && this.viewer.handleResize) {
                this.viewer.handleResize();
            }
        });
        
        // 키보드 단축키
        document.addEventListener('keydown', (event) => {
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return; // 입력 중일 때는 무시
            }
            
            switch (event.code) {
                case 'Digit1':
                case 'Digit2':
                case 'Digit3':
                    const modelIndex = parseInt(event.code.slice(-1)) - 1;
                    if (modelIndex >= 0 && modelIndex < this.models.length) {
                        this.loadModel(modelIndex);
                    }
                    break;
                case 'KeyR':
                    if (this.viewer && this.viewer.resetCamera) {
                        this.viewer.resetCamera();
                    }
                    break;
                case 'KeyF':
                    this.toggleFullscreen();
                    break;
                case 'Space':
                    event.preventDefault();
                    if (this.animationController) {
                        this.animationController.togglePlayPause();
                    }
                    break;
            }
        });
        
        // 타임라인 컨트롤 설정
        this.setupTimelineControls();
        
        // 기타 이벤트
        window.addEventListener('error', (event) => {
            console.error('🚨 전역 오류:', event.error);
        });
    }
    
    /**
     * 타임라인 컨트롤 설정 (기존 로직 유지)
     */
    setupTimelineControls() {
        const timelineSlider = document.getElementById('timeline-slider');
        if (timelineSlider) {
            let isDragging = false;
            
            const startDrag = () => {
                isDragging = true;
                if (this.ui.setTimelineDragging) {
                    this.ui.setTimelineDragging(true);
                }
            };
            
            const endDrag = () => {
                if (isDragging) {
                    isDragging = false;
                    if (this.ui.setTimelineDragging) {
                        this.ui.setTimelineDragging(false);
                    }
                }
            };
            
            timelineSlider.addEventListener('mousedown', startDrag);
            timelineSlider.addEventListener('touchstart', startDrag);
            
            document.addEventListener('mouseup', endDrag);
            document.addEventListener('touchend', endDrag);
            
            // 슬라이더 값 변경 시 시킹
            timelineSlider.addEventListener('input', (e) => {
                if (this.animationController && isDragging) {
                    const percentage = parseFloat(e.target.value);
                    this.animationController.seekToPercentage(percentage);
                }
            });
        }
    }
    
    /**
     * URL 파라미터 처리 (기존 로직 유지)
     */
    handleURLParams() {
        try {
            const params = new URLSearchParams(window.location.search);
            const modelParam = params.get('model');
            
            if (modelParam !== null) {
                const index = parseInt(modelParam, 10);
                if (!isNaN(index) && index >= 0 && index < this.models.length) {
                    this.state.currentModelIndex = index;
                    console.log(`📄 URL 파라미터로 모델 ${index} 선택`);
                } else {
                    console.warn(`⚠️ 잘못된 모델 인덱스: ${modelParam}`);
                }
            }
        } catch (error) {
            console.error('URL 파라미터 처리 오류:', error);
        }
    }
    
    /**
     * 초기 모델 인덱스 가져오기 (기존 로직 유지)
     */
    getInitialModelIndex() {
        return this.state.currentModelIndex ?? this.config.defaultModel ?? 0;
    }
    
    /**
     * UI 상태 동기화 (기존 로직 유지)
     */
    syncUIState() {
        if (this.ui && this.ui.setActiveModel) {
            const initialIndex = this.getInitialModelIndex();
            this.ui.setActiveModel(initialIndex);
        }
    }
    
    /**
     * 초기 모델 로드 (기존 로직 유지)
     */
    async loadInitialModel() {
        const initialIndex = this.getInitialModelIndex();
        console.log(`📦 초기 모델 로드 시작 (인덱스: ${initialIndex})`);
        
        try {
            await this.loadModel(initialIndex);
            console.log('✅ 초기 모델 로드 성공!');
        } catch (loadError) {
            console.error('❌ 초기 모델 로드 실패:', loadError);
            
            // 첫 번째 모델로 재시도 (다른 인덱스였을 경우만)
            if (initialIndex !== 0) {
                console.log('🔄 첫 번째 모델로 재시도...');
                try {
                    await this.loadModel(0);
                    console.log('✅ 백업 모델 로드 성공');
                } catch (retryError) {
                    console.error('❌ 백업 모델 로드도 실패:', retryError);
                    this.handleError(
                        '모델을 로드할 수 없습니다. 네트워크 연결을 확인해주세요.',
                        retryError
                    );
                }
            } else {
                this.handleError(
                    '기본 모델을 로드할 수 없습니다. 페이지를 새로고침해주세요.',
                    loadError
                );
            }
        }
    }
    
    /**
     * 모델 로드 (기존 로직 유지)
     */
    async loadModel(index) {
        // 유효성 검사
        if (this.state.isLoading) {
            console.log('⚠️ 이미 로딩 중입니다.');
            return;
        }
        
        if (index < 0 || index >= this.models.length) {
            throw new Error(`잘못된 모델 인덱스: ${index}`);
        }
        
        const modelConfig = this.models[index];
        console.log(`📦 모델 로드 시작: ${modelConfig.name} (인덱스: ${index})`);
        
        // 로딩 상태 설정
        this.state.isLoading = true;
        this.state.currentModelIndex = index;
        this.state.hasError = false;
        this.state.errorMessage = null;
        
        try {
            // UI 상태 업데이트
            loadingUI.show(modelConfig.name);
            if (this.ui.setActiveModel) {
                this.ui.setActiveModel(index);
            }
            
            // 모델 경로 생성
            const modelPath = `${this.config.basePath}${modelConfig.folder}/${modelConfig.fileName}`;
            console.log(`📂 모델 경로: ${modelPath}`);
            
            // 프로그레시브 로딩 실행
            const result = await this.progressiveLoader.loadWithPreview(modelPath);
            
            // 프리뷰 이미지 설정
            if (result.preview) {
                loadingUI.setPreview(result.preview.src);
            }
            
            // 핫스팟 데이터 로드 시도
            const hotspotsData = await this.loadHotspotsData(modelPath);
            
            // 뷰어에 모델 설정
            await this.viewer.setModel(result.gltf.scene);

            // 모델명 설정 (애니메이션 컨트롤러용)
            if (result.gltf.scene) {
                result.gltf.scene.userData.modelName = modelConfig.folder;
            }
            
            // 애니메이션 설정
            const animations = result.gltf.animations || [];
            if (animations.length > 0) {
                console.log(`🎬 애니메이션 발견: ${animations.length}개`);
                this.animationController.setAnimations(animations, result.gltf.scene);
                this.ui.showTimeline();
            } else {
                console.log('ℹ️ 애니메이션 없음');
                this.ui.hideTimeline();
            }
            
            // 핫스팟 설정
            this.currentHotspotData = hotspotsData;
            if (hotspotsData) {
                this.hotspotManager.loadHotspots(hotspotsData);
                console.log(`📍 핫스팟 로드 완료: ${Object.keys(hotspotsData.hotspots || {}).length}개`);
            } else {
                this.hotspotManager.clearHotspots();
            }
            
            // GLTF 카메라 처리
            this.gltfCameras = result.gltf.cameras || [];
            this.updateCameraSelector();
            
            // 로딩 완료
            loadingUI.hide();
            console.log(`✅ 모델 로드 완료: ${modelConfig.name}`);
            
            // URL 업데이트 (히스토리 없이)
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('model', index.toString());
            window.history.replaceState(null, '', newUrl);
            
            // 센서 차트 자동 표시 (필요한 경우)
            await this.autoDisplayChart(modelConfig.name, animations);
            
        } catch (error) {
            console.error(`❌ 모델 로드 실패: ${modelConfig.name}`, error);
            loadingUI.hide();
            this.handleError(`모델 "${modelConfig.name}"을 로드할 수 없습니다.`, error);
            throw error;
        } finally {
            this.state.isLoading = false;
        }
    }
    
    /**
     * 핫스팟 데이터 로드 (기존 로직 유지)
     */
    async loadHotspotsData(modelPath) {
        try {
            const hotspotsPath = modelPath.replace(/[^\/]+\.gltf$/i, 'hotspots.json');
            const response = await fetch(hotspotsPath);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ 핫스팟 데이터 로드 성공');
                return data;
            }
        } catch (error) {
            console.log('ℹ️ 핫스팟 데이터 없음 또는 로드 실패');
        }
        
        return null;
    }
    
    /**
     * 카메라 셀렉터 업데이트 (기존 로직 유지)
     */
    updateCameraSelector() {
        const cameraSelect = document.getElementById('camera-select');
        if (!cameraSelect) return;
        
        // 기존 옵션 제거
        cameraSelect.innerHTML = '<option value="default">기본 카메라</option>';
        
        // GLTF 카메라 추가
        this.gltfCameras.forEach((camera, index) => {
            const option = document.createElement('option');
            option.value = `gltf-${index}`;
            option.textContent = camera.name || `카메라 ${index + 1}`;
            cameraSelect.appendChild(option);
        });
        
        // 카메라가 있으면 카메라 박스 표시
        if (this.gltfCameras.length > 0) {
            this.ui.showCameraBox();
        } else {
            this.ui.hideCameraBox();
        }
    }
    
    /**
     * 카메라 전환 (기존 로직 유지)
     */
    switchCamera(cameraValue) {
        if (!this.viewer) return;
        
        if (cameraValue === 'default') {
            this.viewer.resetCamera();
        } else if (cameraValue.startsWith('gltf-')) {
            const index = parseInt(cameraValue.replace('gltf-', ''), 10);
            if (!isNaN(index) && this.gltfCameras[index]) {
                this.viewer.switchToGltfCamera(this.gltfCameras[index]);
            }
        }
    }
    
    /**
     * ✅ 센서 차트 토글 (수정된 버전 - 메서드 호출 수정)
     */
    async toggleSensorChart() {
        if (!this.chartManager) {
            console.log('📊 chartManager가 없습니다.');
            return;
        }
        
        // ✅ 수정: isVisible 프로퍼티를 메서드 호출로 변경
        if (this.chartManager.isVisible()) {
            this.chartManager.hide();
        } else {
            const currentModel = this.models[this.state.currentModelIndex];
            if (currentModel) {
                await this.autoDisplayChart(currentModel.name);
            }
        }
    }
    
    /**
     * ✅ 차트 자동 표시 (수정된 버전 - 메서드 호출 수정)
     */
    async autoDisplayChart(modelName, animations = null) {
        if (!this.chartManager) {
            console.log('📊 chartManager가 없습니다. 차트 표시 건너뜀');
            return;
        }
        
        // ✅ 수정: isVisible 프로퍼티를 메서드 호출로 변경
        if (this.chartManager.isVisible()) {
            console.log('📊 차트가 이미 표시되어 있습니다.');
            return;
        }
        
        try {
            // 애니메이션이 있고 재생 중인 경우
            if (animations && animations.length > 0 && this.animationController?.isPlaying) {
                console.log('📊 애니메이션 동기화 차트 표시');
                this.chartManager.syncWithAnimation(this.animationController);
            } else {
                // 정적 데이터 표시
                console.log('📊 기본 데이터 표시 (애니메이션 없음)');
                await this.chartManager.startSimulation(0, 30, modelName);
            }
        } catch (error) {
            console.error('📊 차트 표시 오류:', error);
            // 차트 오류로 인해 전체 로딩이 실패하지 않도록 처리
        }
    }
    
    /**
     * 전체화면 토글 (기존 로직 유지)
     */
    toggleFullscreen() {
        try {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.error('전체화면 전환 실패:', err);
                    this.handleError('전체화면 모드를 사용할 수 없습니다.');
                });
            } else {
                document.exitFullscreen();
            }
        } catch (error) {
            console.error('전체화면 토글 오류:', error);
        }
    }
    
    /**
     * 초기화 오류 처리 (기존 로직 유지)
     */
    handleInitializationError(error) {
        this.state.hasError = true;
        this.state.errorMessage = error.message;
        
        console.error('❌ 초기화 실패:', error);
        console.error('에러 스택:', error.stack);
        
        // 사용자에게 오류 표시
        const errorMsg = '3D 뷰어를 초기화할 수 없습니다. 페이지를 새로고침해주세요.';
        
        if (this.ui) {
            this.ui.showError(errorMsg);
        } else {
            // UI가 없는 경우 직접 표시
            this.showErrorFallback(errorMsg);
        }
    }
    
    /**
     * 일반 오류 처리 (기존 로직 유지)
     */
    handleError(message, error = null) {
        console.error('오류 발생:', message, error);
        
        if (this.ui && this.ui.showError) {
            this.ui.showError(message);
        } else {
            this.showErrorFallback(message);
        }
    }
    
    /**
     * 오류 표시 폴백 (기존 로직 유지)
     */
    showErrorFallback(message) {
        const errorElement = document.getElementById('error') || document.getElementById('loading');
        if (errorElement) {
            errorElement.innerHTML = `
                <div class="error-content">
                    <h3>오류가 발생했습니다</h3>
                    <p>${message}</p>
                    <button onclick="location.reload()">새로고침</button>
                </div>
            `;
            errorElement.style.display = 'flex';
        } else {
            alert(message);
        }
    }
    
    /**
     * 현재 상태 정보 가져오기 (디버깅용)
     */
    getState() {
        return {
            ...this.state,
            models: this.models.map(m => m.name),
            currentModel: this.models[this.state.currentModelIndex]?.name || null,
            hasViewer: !!this.viewer,
            hasUI: !!this.ui,
            hasAnimationController: !!this.animationController,
            hasHotspotManager: !!this.hotspotManager,
            hasChartManager: !!this.chartManager
        };
    }
}