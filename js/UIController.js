// UIController.js - 수정 버전
import { CONFIG } from './config.js';

export class UIController {
    constructor(sceneManager, modelLoader, animationController, hotspotManager) {
        this.sceneManager = sceneManager;
        this.modelLoader = modelLoader;
        this.animationController = animationController;
        this.hotspotManager = hotspotManager;

        this.fps = 0;
        this.frameCount = 0;
        this.lastTime = performance.now();
        
        // 초기화
        this.init();
    }
    
    init() {
        console.log('[UIController] 초기화 시작');
        
        // DOM 요소 캐싱
        this.cacheDOMElements();
        
        // DOM 요소 확인
        this.verifyDOMElements();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 모델 선택 화면 표시
        this.showModelSelector();
        
        console.log('[UIController] 초기화 완료');
    }
    
    cacheDOMElements() {
        // 필수 요소들
        this.modelSelector = document.getElementById('model-selector');
        this.modelList = document.getElementById('model-list');
        this.changeModelBtn = document.getElementById('changeModel');
        this.controlPanel = document.getElementById('control-panel');
        this.infoPanel = document.getElementById('info-panel');
        
        // 컨트롤 요소들
        this.playBtn = document.getElementById('playBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.frameSlider = document.getElementById('frameSlider');
        this.frameDisplay = document.getElementById('frameDisplay');
        this.toggleHotspotsBtn = document.getElementById('toggleHotspots');
        this.toggleGridBtn = document.getElementById('toggleGrid');
        this.cameraView = document.getElementById('cameraView');
        
        // 정보 표시 요소들
        this.meshCount = document.getElementById('meshCount');
        this.vertexCount = document.getElementById('vertexCount');
        this.triangleCount = document.getElementById('triangleCount');
        this.hotspotCount = document.getElementById('hotspotCount');
        this.fpsDisplay = document.getElementById('fps');
        
        // 로딩/에러 요소들
        this.loading = document.getElementById('loading');
        this.error = document.getElementById('error');
    }
    
    verifyDOMElements() {
        const criticalElements = {
            'modelSelector': this.modelSelector,
            'modelList': this.modelList,
            'controlPanel': this.controlPanel,
            'infoPanel': this.infoPanel
        };
        
        const missing = [];
        Object.entries(criticalElements).forEach(([name, element]) => {
            if (!element) {
                missing.push(name);
            }
        });
        
        if (missing.length > 0) {
            console.error('[UIController] 필수 DOM 요소 누락:', missing);
            console.log('[UIController] 현재 DOM 상태:');
            missing.forEach(name => {
                console.log(`  - ${name}: ${document.getElementById(name.replace(/([A-Z])/g, '-$1').toLowerCase()) ? '존재(다른 ID)' : '없음'}`);
            });
        }
    }

    setupEventListeners() {
        // 모델 변경 버튼
        if (this.changeModelBtn) {
            this.changeModelBtn.addEventListener('click', () => this.showModelSelector());
        }
        
        // 애니메이션 컨트롤
        if (this.playBtn) {
            this.playBtn.addEventListener('click', () => this.animationController.play());
        }
        if (this.pauseBtn) {
            this.pauseBtn.addEventListener('click', () => this.animationController.pause());
        }
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => this.animationController.reset());
        }
        
        // 프레임 슬라이더
        if (this.frameSlider) {
            this.frameSlider.addEventListener('input', (e) => {
                this.animationController.setFrame(parseInt(e.target.value));
            });
        }
        
        // 토글 버튼들
        if (this.toggleHotspotsBtn) {
            this.toggleHotspotsBtn.addEventListener('click', () => {
                this.hotspotManager.toggleVisibility();
            });
        }
        if (this.toggleGridBtn) {
            this.toggleGridBtn.addEventListener('click', () => {
                this.sceneManager.toggleGrid();
            });
        }
        
        // 카메라 뷰
        if (this.cameraView) {
            this.cameraView.addEventListener('change', (e) => {
                this.sceneManager.setCameraView(e.target.value);
            });
        }
        
        // 슬라이더들
        this.setupSliderListeners();
    }
    
    setupSliderListeners() {
        // 밝기 슬라이더
        const brightnessSlider = document.getElementById('brightnessSlider');
        if (brightnessSlider) {
            brightnessSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                const display = document.getElementById('brightnessDisplay');
                if (display) display.textContent = value.toFixed(1);
                this.sceneManager.renderer.toneMappingExposure = value;
            });
        }
        
        // 주 조명 슬라이더
        const mainLightSlider = document.getElementById('mainLightSlider');
        if (mainLightSlider) {
            mainLightSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                const display = document.getElementById('mainLightDisplay');
                if (display) display.textContent = value.toFixed(1);
                if (this.sceneManager.lights.directional) {
                    this.sceneManager.lights.directional.intensity = value;
                }
            });
        }
    }
    
    showModelSelector() {
        console.log('[UIController] 모델 선택 화면 표시 시도');
        
        if (!this.modelSelector) {
            console.error('[UIController] modelSelector 요소를 찾을 수 없습니다');
            return;
        }
        
        // 모델 선택 화면 표시
        this.modelSelector.style.display = 'flex';
        
        // 다른 패널들 숨기기
        if (this.controlPanel) this.controlPanel.style.display = 'none';
        if (this.infoPanel) this.infoPanel.style.display = 'none';
        if (this.changeModelBtn) this.changeModelBtn.style.display = 'none';
        
        // 모델 목록 로드
        this.loadModelList();
    }
    
    loadModelList() {
        console.log('[UIController] 모델 목록 로드 시작');
        
        if (!this.modelList) {
            console.error('[UIController] modelList 요소를 찾을 수 없습니다');
            return;
        }
        
        // CONFIG 확인
        if (!CONFIG || !CONFIG.models || CONFIG.models.length === 0) {
            console.error('[UIController] CONFIG.models가 정의되지 않았거나 비어있습니다');
            this.modelList.innerHTML = `
                <div style="color: #ff6b6b; text-align: center; padding: 20px;">
                    <p>사용 가능한 모델이 없습니다.</p>
                    <p style="font-size: 14px; margin-top: 10px;">config.js 파일을 확인하세요.</p>
                </div>
            `;
            return;
        }
        
        // 모델 카드 생성
        this.modelList.innerHTML = '';
        console.log(`[UIController] ${CONFIG.models.length}개의 모델 로드`);
        
        CONFIG.models.forEach((model, index) => {
            console.log(`[UIController] 모델 ${index + 1}: ${model.name}`);
            
            const card = document.createElement('div');
            card.className = 'model-card';
            card.innerHTML = `
                <div class="model-icon">${model.icon || '📦'}</div>
                <div class="model-name">${model.name}</div>
                <div class="model-info">${model.description || ''}</div>
            `;
            
            card.addEventListener('click', () => {
                console.log(`[UIController] 모델 선택됨: ${model.name}`);
                this.selectModel(model);
            });
            
            this.modelList.appendChild(card);
        });
    }
    
    async selectModel(model) {
        console.log('[UIController] 모델 선택:', model);
        
        // 모델 선택 화면 숨기기
        if (this.modelSelector) {
            this.modelSelector.style.display = 'none';
        }
        
        try {
            // 파일명 확인
            if (!model.fileName) {
                throw new Error(`'${model.name}' 모델의 fileName이 지정되지 않았습니다.`);
            }
            
            // 모델 경로 생성
            const modelPath = `${CONFIG.modelsPath}${model.folder}/${model.fileName}`;
            console.log('[UIController] 모델 경로:', modelPath);
            
            // 모델 로드
            const gltf = await this.modelLoader.loadGLTF(modelPath);
            
            // 모델 정보 업데이트
            this.updateModelInfo(gltf.userData.modelInfo);
            
            // UI 패널 표시
            if (this.controlPanel) this.controlPanel.style.display = 'block';
            if (this.infoPanel) this.infoPanel.style.display = 'block';
            if (this.changeModelBtn) this.changeModelBtn.style.display = 'block';
            
            console.log('[UIController] 모델 로드 완료');
            
        } catch (error) {
            console.error('[UIController] 모델 로드 실패:', error);
            this.modelLoader.showError(`모델 로드 실패: ${error.message}`);
            
            // 에러 발생 시 다시 모델 선택 화면으로
            setTimeout(() => {
                this.showModelSelector();
            }, 3000);
        }
    }

    updateModelInfo(info) {
        console.log('[UIController] 모델 정보 업데이트:', info);
        
        // 정보 표시 업데이트
        if (this.meshCount) this.meshCount.textContent = info.meshCount;
        if (this.vertexCount) this.vertexCount.textContent = info.vertexCount.toLocaleString();
        if (this.triangleCount) this.triangleCount.textContent = info.triangleCount.toLocaleString();
        if (this.hotspotCount) this.hotspotCount.textContent = info.hotspots.length;

        // 카메라 뷰 옵션 업데이트
        if (this.cameraView) {
            this.cameraView.innerHTML = '<option value="default">기본 뷰</option>';
            
            const gltfCameras = this.modelLoader.getCameras();
            if (gltfCameras && gltfCameras.length > 0) {
                gltfCameras.forEach((camera, index) => {
                    const option = document.createElement('option');
                    option.value = `gltf_${index}`;
                    option.textContent = camera.name || `카메라 ${index + 1}`;
                    this.cameraView.appendChild(option);
                });
                console.log(`[UIController] ${gltfCameras.length}개의 GLTF 카메라 추가됨`);
            }
        }

        // 애니메이션 컨트롤 표시/숨김
        const animControls = document.getElementById('animation-controls');
        const frameControls = document.getElementById('frame-controls');
        
        if (this.animationController.hasAnimations()) {
            if (animControls) animControls.style.display = 'block';
            if (frameControls) frameControls.style.display = 'block';
            
            // 프레임 슬라이더 최대값 설정
            if (this.frameSlider) {
                const maxFrames = Math.floor(this.animationController.duration * this.animationController.fps);
                this.frameSlider.max = maxFrames;
            }
        } else {
            if (animControls) animControls.style.display = 'none';
            if (frameControls) frameControls.style.display = 'none';
        }

        // 핫스팟 생성
        this.hotspotManager.clearHotspots();
        info.hotspots.forEach(hotspot => {
            this.hotspotManager.createHotspot(
                hotspot.name, 
                hotspot.position, 
                hotspot.userData
            );
        });
    }
    
    updateFPS() {
        this.frameCount++;
        const currentTime = performance.now();
        
        if (currentTime >= this.lastTime + 1000) {
            this.fps = this.frameCount;
            if (this.fpsDisplay) {
                this.fpsDisplay.textContent = this.fps;
            }
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
    }
    
    updateAnimationFrame(frame) {
        if (this.frameSlider) {
            this.frameSlider.value = frame;
        }
        if (this.frameDisplay) {
            this.frameDisplay.textContent = frame;
        }
    }
}