// js/app.js - 메인 애플리케이션 컨트롤러 (프로그레시브 로딩 통합 + 오류 수정)

import { Viewer3D } from './viewer.js';
import { ProgressiveLoader, LOADING_MESSAGES } from './progressive-loader.js';
import { loadingUI } from './loading-ui.js';
import { UIController } from './ui.js';
import { SensorAnimationController } from './sensor-animation.js';
import { HotspotSpriteManager } from './hotspot-sprite.js';
import { SensorChartManager } from './sensor-chart.js';

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
 * 옹벽 3D 뷰어 애플리케이션
 */
export class WallViewerApp {
    constructor() {
        this.config = CONFIG;
        this.models = MODELS;
        
        // 모듈 인스턴스
        this.viewer = null;
        this.loader = null;
        this.progressiveLoader = null;
        this.ui = null;
        this.animationController = null;
        this.hotspotManager = null;
        this.chartManager = null;
        
        // 상태
        this.isLoading = false;
        this.currentModelIndex = null;
        this.currentHotspotData = null;
        this.gltfCameras = [];
        
        // 초기화
        this.init();
    }
    
    /**
     * 애플리케이션 초기화
     */
    async init() {
        try {
            console.log('🚀 3D 뷰어 초기화 시작...');
            
            // URL 파라미터 처리
            this.handleURLParams();
            
            // 모듈 초기화
            await this.initializeModules();
            
            // 이벤트 리스너
            this.setupEventListeners();
            
            // 초기 모델 로드
            const initialIndex = this.getInitialModelIndex();
            await this.loadModel(initialIndex);
            
            console.log('✅ 3D 뷰어 초기화 완료!');
            
        } catch (error) {
            console.error('❌ 초기화 실패:', error);
            if (this.ui) {
                this.ui.showError('뷰어 초기화에 실패했습니다.');
            }
        }
    }
    
    /**
     * 모듈 초기화
     */
    async initializeModules() {
        // 3D 뷰어
        this.viewer = new Viewer3D(this.config);
        this.viewer.app = this; // 상호 참조
        await this.viewer.init();
        
        // 프로그레시브 로더
        this.progressiveLoader = new ProgressiveLoader({
            basePath: this.config.basePath,
            loadingManager: this.viewer.loadingManager,
            
            // 상태 변경 콜백
            onStateChange: (state) => {
                console.log(`📊 로딩 상태: ${state}`);
                loadingUI.updateState(state);
            },
            
            // 진행률 콜백
            onProgress: (progress) => {
                loadingUI.updateProgress(progress);
            }
        });
        
        // 하위 호환성을 위해 loader도 참조
        this.loader = this.progressiveLoader;
        
        // 애니메이션 컨트롤러
        this.animationController = new SensorAnimationController(this.viewer);
        
        // 핫스팟 매니저 (Sprite 버전)
        this.hotspotManager = new HotspotSpriteManager(this.viewer);
        
        // UI 컨트롤러
        this.ui = new UIController({
            models: this.models,
            onModelSelect: (index) => this.loadModel(index),
            onViewChange: (view) => this.viewer.setView(view),
            onReset: () => this.viewer.resetCamera()
        });
        this.ui.init();
        
        // 누락된 메서드 임시 추가
        if (!this.ui.showCameraBox) {
            this.ui.showCameraBox = function() {
                if (this.elements.cameraBox) {
                    this.elements.cameraBox.classList.add('show');
                }
            };
        }
        
        if (!this.ui.hideCameraBox) {
            this.ui.hideCameraBox = function() {
                if (this.elements.cameraBox) {
                    this.elements.cameraBox.classList.remove('show');
                }
            };
        }
        
        if (!this.ui.setTimelineDragging) {
            this.ui.setTimelineDragging = function(isDragging) {
                // 타임라인 드래깅 상태 설정
            };
        }

        // 센서 차트 매니저
        this.chartManager = new SensorChartManager();
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 창 크기 변경
        window.addEventListener('resize', () => {
            this.viewer.handleResize();
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

        // 센서 차트 버튼
        const chartBtn = document.getElementById('chart-toggle-btn');
        if (chartBtn) {
            chartBtn.addEventListener('click', () => {
                this.toggleSensorChart();
            });
        }
        
        // 카메라 선택
        const cameraSelect = document.getElementById('camera-select');
        if (cameraSelect) {
            cameraSelect.addEventListener('change', (e) => {
                this.switchCamera(e.target.value);
            });
        }
        
        // 타임라인 드래그 시작/종료
        const timelineSlider = document.getElementById('timeline-slider');
        if (timelineSlider) {
            timelineSlider.addEventListener('mousedown', () => {
                this.ui.setTimelineDragging(true);
            });
            
            timelineSlider.addEventListener('mouseup', () => {
                this.ui.setTimelineDragging(false);
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
     * 모델 로드 (프로그레시브 로딩 적용)
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
            // 향상된 로딩 UI 표시
            loadingUI.show(modelConfig.name);
            this.ui.setActiveModel(index);
            
            // 모델 경로 생성
            const modelPath = `${this.config.basePath}${modelConfig.folder}/${modelConfig.fileName}`;
            console.log(`📦 프로그레시브 로딩 시작: ${modelConfig.name}`);
            console.log(`📂 경로: ${modelPath}`);
            
            // 프로그레시브 로딩 (프리뷰 포함)
            const result = await this.progressiveLoader.loadWithPreview(modelPath);
            
            // 프리뷰 이미지가 있으면 UI에 표시
            if (result.preview) {
                loadingUI.setPreview(result.preview.src);
            }
            
            // 핫스팟 데이터 로드 (선택사항)
            const hotspotsPath = modelPath.replace(/[^\/]+\.gltf$/i, 'hotspots.json');
            let hotspotsData = null;
            
            try {
                const response = await fetch(hotspotsPath);
                if (response.ok) {
                    hotspotsData = await response.json();
                    console.log('✅ 핫스팟 데이터 로드 성공');
                    console.log('📍 핫스팟 개수:', Object.keys(hotspotsData.hotspots || {}).length);
                }
            } catch (e) {
                // 핫스팟 데이터는 선택사항이므로 오류 무시
            }
            
            // 뷰어에 모델 설정
            this.viewer.setModel(result.gltf.scene);
            
            // 애니메이션 설정
            if (result.gltf.animations && result.gltf.animations.length > 0) {
                console.log(`🎬 애니메이션 발견: ${result.gltf.animations.length}개`);
                this.animationController.setAnimations(
                    result.gltf.animations,
                    result.gltf.scene
                );
                
                // 모델명 전달
                if (this.animationController.setModelName) {
                    this.animationController.setModelName(modelConfig.folder);
                }
            } else {
                console.log('🎬 애니메이션 없음');
                this.animationController.clearAnimations();
            }
            
            // 핫스팟 설정
            this.hotspotManager.clearHotspots();
            if (hotspotsData) {
                if (hotspotsData.hotspots && typeof hotspotsData.hotspots === 'object') {
                    // loadHotspots 메서드 사용 (모델과 JSON 데이터 전달)
                    console.log(`📍 핫스팟 로드 중...`);
                    this.hotspotManager.loadHotspots(result.gltf.scene, hotspotsData);
                } else {
                    console.warn('⚠️ 핫스팟 데이터 구조가 올바르지 않습니다');
                }
            }
            
            // 카메라 설정
            if (result.gltf.cameras && result.gltf.cameras.length > 0) {
                console.log(`📷 GLTF 카메라 발견: ${result.gltf.cameras.length}개`);
                this.gltfCameras = result.gltf.cameras;
                this.updateCameraUI();
            } else {
                this.gltfCameras = [];
                // hideCameraBox가 있으면 호출
                if (this.ui.hideCameraBox) {
                    this.ui.hideCameraBox();
                }
            }
            
            // 로딩 완료 - 약간의 딜레이 후 숨김
            setTimeout(() => {
                loadingUI.hide();
            }, 500);
            
            console.log(`✅ 모델 로드 완료: ${modelConfig.name}`);
            
        } catch (error) {
            console.error('❌ 모델 로드 실패:', error);
            loadingUI.showError(error.message || '모델을 로드할 수 없습니다.');
            
            // 3초 후 로딩 UI 숨김
            setTimeout(() => {
                loadingUI.hide();
            }, 3000);
            
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * 카메라 UI 업데이트
     */
    updateCameraUI() {
        const cameraSelect = document.getElementById('camera-select');
        if (!cameraSelect) return;
        
        // 옵션 초기화
        cameraSelect.innerHTML = '<option value="default">기본 카메라</option>';
        
        // GLTF 카메라 추가
        this.gltfCameras.forEach((camera, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = camera.name || `카메라 ${index + 1}`;
            cameraSelect.appendChild(option);
        });
        
        // 카메라 박스 표시 (메서드가 있으면)
        if (this.ui.showCameraBox) {
            this.ui.showCameraBox();
        }
    }
    
    /**
     * 카메라 전환
     */
    switchCamera(cameraIndex) {
        if (cameraIndex === 'default') {
            // 기본 카메라로 전환
            this.viewer.resetCamera(true);  // 애니메이션 적용
        } else {
            // 커스텀 카메라로 전환
            const index = parseInt(cameraIndex);
            if (this.gltfCameras[index]) {
                this.viewer.applyCustomCamera(this.gltfCameras[index], true);
            }
        }
    }
    
    /**
     * 센서 차트 토글
     */
    async toggleSensorChart() {
        if (!this.chartManager) {
            console.error('차트 매니저가 초기화되지 않았습니다');
            return;
        }
        
        // 차트가 보이지 않으면 표시
        if (!this.chartManager.isVisible) {
            this.chartManager.show();
            
            // 모델 폴더명 가져오기
            const modelName = this.models[this.currentModelIndex].folder;
            console.log('📊 차트 표시 - 모델:', modelName);
            
            // 현재 애니메이션 프레임 가져오기
            if (this.animationController && this.animationController.currentTime !== undefined) {
                const currentFrame = this.animationController.timeToFrame(this.animationController.currentTime);
                const maxFrame = this.animationController.timeToFrame(this.animationController.duration);
                
                console.log(`📊 애니메이션 데이터: ${currentFrame}/${maxFrame} 프레임`);
                
                // 차트 시뮬레이션 시작
                await this.chartManager.startSimulation(currentFrame, maxFrame, modelName);
            } else {
                // 애니메이션이 없으면 기본 데이터 표시
                console.log('📊 기본 데이터 표시 (애니메이션 없음)');
                await this.chartManager.startSimulation(0, 30, modelName);
            }
        } else {
            // 차트 숨기기
            this.chartManager.hide();
        }
    }
    
    /**
     * 전체화면 토글
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('전체화면 전환 실패:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }
}

// 애플리케이션 시작
window.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM 로드 완료, 애플리케이션 시작...');
    const app = new WallViewerApp();
    window.app = app;
    
    // 프로그레시브 로딩 CSS 확인 및 로드
    const hasProgressiveCSS = Array.from(document.styleSheets).some(sheet => {
        try {
            return sheet.href && sheet.href.includes('progressive-loading.css');
        } catch(e) {
            return false;
        }
    });
    
    if (!hasProgressiveCSS) {
        console.log('📄 프로그레시브 로딩 CSS 동적 로드');
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/progressive-loading.css';
        document.head.appendChild(link);
    }
});