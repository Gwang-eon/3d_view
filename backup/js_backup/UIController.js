// UIController.js - 완전한 UI 컨트롤러
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
        
        // 카메라 컨트롤 상태
        this.cameraControlState = {
            currentOrbitAngle: 0,
            isTransitioning: false,
            savedStates: new Map()
        };
        
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
        
        // 카메라 컨트롤 설정 (개선된 기능)
        this.setupCameraControls();
        
        // 카메라 속도 컨트롤 생성 (새로운 기능)
        this.createCameraSpeedControls();
        
        // 모델 선택 화면 표시
        this.showModelSelector();
        
        // FPS 모니터 시작
        this.startFPSMonitor();
        
        console.log('[UIController] 초기화 완료');
    }
    
    cacheDOMElements() {
        // 필수 요소들
        this.modelSelector = document.getElementById('model-selector');
        this.modelList = document.getElementById('model-list');
        this.changeModelBtn = document.getElementById('changeModel');
        
        // viewer.html 전용 요소들
        this.loadingScreen = document.getElementById('loading');
        this.progressBar = document.getElementById('progress-fill');
        this.progressText = document.getElementById('progress-text');
        
        // 정보 표시 요소들
        this.meshCount = document.getElementById('mesh-count');
        this.vertexCount = document.getElementById('vertex-count');
        this.triangleCount = document.getElementById('triangle-count');
        this.hotspotCount = document.getElementById('hotspot-count');
        
        // 카메라 관련 요소들
        this.cameraView = document.getElementById('camera-view');
        this.cameraSpeed = document.getElementById('camera-speed');
        this.cameraEasing = document.getElementById('camera-easing');
        
        // 컨트롤 패널 요소들
        this.controlPanel = document.getElementById('control-panel');
        this.fpsDisplay = document.getElementById('fps');
        
        // 애니메이션 컨트롤
        this.playBtn = document.getElementById('play-pause');
        this.timelineSlider = document.getElementById('timeline-slider');
        this.currentTimeDisplay = document.getElementById('current-time');
        this.totalTimeDisplay = document.getElementById('total-time');
        
        // 추가 컨트롤들
        this.gridToggle = document.getElementById('grid-toggle');
        this.panelToggle = document.getElementById('panel-toggle');
    }
    
    verifyDOMElements() {
        const requiredElements = ['model-selector', 'model-list'];
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        
        if (missingElements.length > 0) {
            console.warn('[UIController] 누락된 DOM 요소:', missingElements);
        }
    }
    
    setupEventListeners() {
        // 모델 변경 버튼
        if (this.changeModelBtn) {
            this.changeModelBtn.addEventListener('click', () => {
                this.showModelSelector();
            });
        }
        
        // 그리드 토글
        if (this.gridToggle) {
            this.gridToggle.addEventListener('change', (e) => {
                this.sceneManager.toggleGrid();
            });
        }
        
        // 패널 토글
        if (this.panelToggle) {
            this.panelToggle.addEventListener('click', () => {
                this.toggleControlPanel();
            });
        }
        
        // 애니메이션 컨트롤
        if (this.playBtn) {
            this.playBtn.addEventListener('click', () => {
                this.toggleAnimation();
            });
        }
        
        if (this.timelineSlider) {
            this.timelineSlider.addEventListener('input', (e) => {
                this.animationController.setProgress(parseFloat(e.target.value));
            });
        }
        
        // 카메라 뷰 선택
        if (this.cameraView) {
            this.cameraView.addEventListener('change', (e) => {
                this.sceneManager.setCameraView(e.target.value);
            });
        }
        
        // 홈 버튼
        const homeBtn = document.getElementById('home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }
    }
    
    // 카메라 컨트롤 설정 - 개선된 버전
    setupCameraControls() {
        // 카메라 전환 상태 표시
        this.cameraTransitionIndicator = null;
        
        // 프리셋 뷰 버튼 추가
        this.createPresetViewButtons();
        
        // 모델 포커스 버튼
        const focusModelBtn = document.getElementById('focus-model');
        if (focusModelBtn) {
            focusModelBtn.addEventListener('click', () => {
                this.showCameraTransitionIndicator('모델 포커스');
                this.sceneManager.setCameraView('focus-model', {
                    duration: 1.2,
                    easeType: 'easeOutCubic'
                });
            });
        }
        
        // 회전 뷰 버튼
        const orbitViewBtn = document.getElementById('orbit-view');
        if (orbitViewBtn) {
            orbitViewBtn.addEventListener('click', () => {
                this.cameraControlState.currentOrbitAngle = (this.cameraControlState.currentOrbitAngle + 90) % 360;
                this.showCameraTransitionIndicator(`${this.cameraControlState.currentOrbitAngle}° 회전`);
                this.sceneManager.setCameraView(`orbit-${this.cameraControlState.currentOrbitAngle}`, {
                    duration: 1.5,
                    easeType: 'easeInOutSine'
                });
            });
        }
        
        // 줌 버튼 추가
        this.createZoomControls();
        
        // 카메라 전환 속도 설정
        if (this.cameraSpeed) {
            this.cameraSpeed.addEventListener('change', (e) => {
                const duration = parseFloat(e.target.value);
                this.sceneManager.setCameraTransitionDuration(duration);
            });
        }
        
        // 이징 타입 선택
        if (this.cameraEasing) {
            this.cameraEasing.addEventListener('change', (e) => {
                this.sceneManager.setCameraTransitionEasing(e.target.value);
            });
        }
        
        // 키보드 단축키
        this.setupKeyboardShortcuts();
        
        // 카메라 전환 이벤트 리스너
        if (this.sceneManager) {
            this.sceneManager.onCameraTransitionStart = (viewName) => {
                this.cameraControlState.isTransitioning = true;
                this.disableInteractionDuringTransition();
            };
            
            this.sceneManager.onCameraTransitionEnd = (viewName) => {
                this.cameraControlState.isTransitioning = false;
                this.enableInteractionAfterTransition();
                this.hideCameraTransitionIndicator();
            };
        }
    }
    
    // 카메라 속도 컨트롤 생성 - 새로운 기능
    createCameraSpeedControls() {
        const viewControls = document.querySelector('.view-controls');
        if (!viewControls) return;
        
        const speedControlsHtml = `
            <div class="camera-speed-controls">
                <h5>카메라 속도 조절</h5>
                <div class="speed-control-group">
                    <label>회전 속도:</label>
                    <input type="range" id="rotate-speed" min="0.1" max="2" step="0.1" value="${CONFIG.controls.rotateSpeed}">
                    <span id="rotate-speed-value">${CONFIG.controls.rotateSpeed}</span>
                </div>
                <div class="speed-control-group">
                    <label>줌 속도:</label>
                    <input type="range" id="zoom-speed" min="0.1" max="2" step="0.1" value="${CONFIG.controls.zoomSpeed}">
                    <span id="zoom-speed-value">${CONFIG.controls.zoomSpeed}</span>
                </div>
                <div class="speed-control-group">
                    <label>팬 속도:</label>
                    <input type="range" id="pan-speed" min="0.1" max="2" step="0.1" value="${CONFIG.controls.panSpeed}">
                    <span id="pan-speed-value">${CONFIG.controls.panSpeed}</span>
                </div>
                <div class="speed-control-group">
                    <label>감속 강도:</label>
                    <input type="range" id="damping-factor" min="0.05" max="0.25" step="0.01" value="${CONFIG.controls.dampingFactor}">
                    <span id="damping-factor-value">${CONFIG.controls.dampingFactor}</span>
                </div>
            </div>
        `;
        
        const speedControlDiv = document.createElement('div');
        speedControlDiv.innerHTML = speedControlsHtml;
        viewControls.appendChild(speedControlDiv);
        
        // 이벤트 리스너 추가
        this.setupSpeedControlListeners();
    }
    
    // 속도 컨트롤 이벤트 리스너
    setupSpeedControlListeners() {
        const controls = [
            { id: 'rotate-speed', property: 'rotateSpeed' },
            { id: 'zoom-speed', property: 'zoomSpeed' },
            { id: 'pan-speed', property: 'panSpeed' },
            { id: 'damping-factor', property: 'dampingFactor' }
        ];
        
        controls.forEach(control => {
            const slider = document.getElementById(control.id);
            const valueSpan = document.getElementById(`${control.id}-value`);
            
            if (slider && valueSpan) {
                slider.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    valueSpan.textContent = value.toFixed(2);
                    
                    if (control.property === 'dampingFactor') {
                        if (this.sceneManager.controls) {
                            this.sceneManager.controls.dampingFactor = value;
                        }
                    } else {
                        // 속도 설정 업데이트
                        const currentSpeeds = {
                            rotateSpeed: parseFloat(document.getElementById('rotate-speed').value),
                            zoomSpeed: parseFloat(document.getElementById('zoom-speed').value),
                            panSpeed: parseFloat(document.getElementById('pan-speed').value)
                        };
                        
                        this.sceneManager.setCameraSpeed(
                            currentSpeeds.rotateSpeed,
                            currentSpeeds.zoomSpeed,
                            currentSpeeds.panSpeed
                        );
                    }
                });
            }
        });
    }
    
    // 프리셋 뷰 버튼 생성
    createPresetViewButtons() {
        const viewControls = document.querySelector('.view-controls');
        if (!viewControls) return;
        
        const presetContainer = document.createElement('div');
        presetContainer.className = 'preset-view-buttons';
        presetContainer.innerHTML = `
            <div class="view-preset-group">
                <button class="view-btn preset-btn" data-view="front" title="정면">
                    <span>⬜</span>
                </button>
                <button class="view-btn preset-btn" data-view="right" title="우측">
                    <span>➡️</span>
                </button>
                <button class="view-btn preset-btn" data-view="top" title="상단">
                    <span>⬆️</span>
                </button>
                <button class="view-btn preset-btn" data-view="isometric" title="등각">
                    <span>◻️</span>
                </button>
            </div>
        `;
        
        viewControls.appendChild(presetContainer);
        
        // 프리셋 버튼 이벤트
        presetContainer.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.showCameraTransitionIndicator(`${view} 뷰`);
                this.sceneManager.setCameraView(view);
            });
        });
    }
    
    // 줌 컨트롤 생성
    createZoomControls() {
        const viewControls = document.querySelector('.view-controls');
        if (!viewControls) return;
        
        const zoomContainer = document.createElement('div');
        zoomContainer.className = 'zoom-controls';
        zoomContainer.innerHTML = `
            <button class="view-btn zoom-btn" id="zoom-in" title="확대">
                <span>🔍+</span>
            </button>
            <button class="view-btn zoom-btn" id="zoom-out" title="축소">
                <span>🔍-</span>
            </button>
            <button class="view-btn zoom-btn" id="zoom-fit" title="화면 맞춤">
                <span>⬜</span>
            </button>
        `;
        
        viewControls.appendChild(zoomContainer);
        
        // 줌 버튼 이벤트
        document.getElementById('zoom-in')?.addEventListener('click', () => {
            this.sceneManager.setCameraView('zoom-in');
        });
        
        document.getElementById('zoom-out')?.addEventListener('click', () => {
            this.sceneManager.setCameraView('zoom-out');
        });
        
        document.getElementById('zoom-fit')?.addEventListener('click', () => {
            this.showCameraTransitionIndicator('화면 맞춤');
            this.sceneManager.setCameraView('focus-model');
        });
    }
    
    // 키보드 단축키 설정
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (this.cameraControlState.isTransitioning) return;
            
            // 숫자 키로 프리셋 뷰
            const viewMap = {
                '1': 'front',
                '2': 'right',
                '3': 'top',
                '4': 'isometric',
                '0': 'default'
            };
            
            if (viewMap[e.key]) {
                this.showCameraTransitionIndicator(`${viewMap[e.key]} 뷰`);
                this.sceneManager.setCameraView(viewMap[e.key]);
            }
            
            // 방향키로 회전
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const angle = e.key === 'ArrowLeft' ? -90 : 90;
                this.rotateCameraView(angle);
            }
            
            // +/- 키로 줌
            if (e.key === '+' || e.key === '=') {
                this.sceneManager.setCameraView('zoom-in');
            } else if (e.key === '-' || e.key === '_') {
                this.sceneManager.setCameraView('zoom-out');
            }
            
            // F 키로 포커스
            if (e.key === 'f' || e.key === 'F') {
                this.showCameraTransitionIndicator('모델 포커스');
                this.sceneManager.setCameraView('focus-model');
            }
            
            // 스페이스바로 애니메이션 재생/일시정지
            if (e.key === ' ') {
                e.preventDefault();
                this.toggleAnimation();
            }
        });
    }
    
    // 카메라 회전
    rotateCameraView(angle) {
        const currentAngle = this.cameraControlState.currentOrbitAngle;
        const newAngle = (currentAngle + angle + 360) % 360;
        this.cameraControlState.currentOrbitAngle = newAngle;
        
        this.showCameraTransitionIndicator(`${newAngle}° 회전`);
        this.sceneManager.setCameraView(`orbit-${newAngle}`);
    }
    
    // 카메라 전환 중 표시
    showCameraTransitionIndicator(message) {
        if (!this.cameraTransitionIndicator) {
            this.cameraTransitionIndicator = document.createElement('div');
            this.cameraTransitionIndicator.className = 'camera-hint';
            document.body.appendChild(this.cameraTransitionIndicator);
        }
        
        this.cameraTransitionIndicator.textContent = message;
        this.cameraTransitionIndicator.style.display = 'block';
        
        // 애니메이션 재시작
        this.cameraTransitionIndicator.style.animation = 'none';
        setTimeout(() => {
            this.cameraTransitionIndicator.style.animation = 'camera-transition-hint 2s ease-out';
        }, 10);
    }
    
    // 카메라 전환 표시 숨기기
    hideCameraTransitionIndicator() {
        if (this.cameraTransitionIndicator) {
            setTimeout(() => {
                this.cameraTransitionIndicator.style.display = 'none';
            }, 2000);
        }
    }
    
    // 전환 중 상호작용 비활성화
    disableInteractionDuringTransition() {
        document.querySelectorAll('.view-btn, .preset-btn, .zoom-btn').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
        });
        
        // 카메라 뷰 선택도 비활성화
        if (this.cameraView) {
            this.cameraView.disabled = true;
        }
    }
    
    // 전환 후 상호작용 재활성화
    enableInteractionAfterTransition() {
        document.querySelectorAll('.view-btn, .preset-btn, .zoom-btn').forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
        });
        
        // 카메라 뷰 선택 재활성화
        if (this.cameraView) {
            this.cameraView.disabled = false;
        }
    }
    
    // 모델 선택 화면 표시
    showModelSelector() {
        if (this.modelSelector) {
            this.modelSelector.style.display = 'flex';
            this.loadModelList();
        }
    }
    
    hideModelSelector() {
        if (this.modelSelector) {
            this.modelSelector.style.display = 'none';
        }
    }
    
    // 모델 목록 로드
    loadModelList() {
        if (!this.modelList) return;
        
        this.modelList.innerHTML = '';
        
        CONFIG.models.forEach((model, index) => {
            const modelCard = document.createElement('div');
            modelCard.className = 'model-card';
            modelCard.innerHTML = `
                <div class="model-icon">${model.icon}</div>
                <h3>${model.name}</h3>
                <p>${model.description}</p>
            `;
            
            modelCard.addEventListener('click', () => {
                this.selectModel(index);
            });
            
            this.modelList.appendChild(modelCard);
        });
    }
    
    // 모델 선택
    async selectModel(index) {
        const model = CONFIG.models[index];
        if (!model) return;
        
        console.log(`[UIController] 모델 선택: ${model.name}`);
        
        try {
            this.hideModelSelector();
            this.showLoading();
            
            const result = await this.modelLoader.loadModel(index);
            
            if (result.success) {
                console.log('[UIController] 모델 로드 성공');
                this.hideLoading();
                
                // 모델 정보 업데이트
                this.updateModelInfo(result.info, model.name, result.loadTime);
                
                // 애니메이션 컨트롤 업데이트
                this.updateAnimationControls();
                
                // 모델 변경 버튼 표시
                if (this.changeModelBtn) {
                    this.changeModelBtn.style.display = 'inline-block';
                }
            } else {
                throw new Error(result.error || '모델 로드 실패');
            }
        } catch (error) {
            console.error('[UIController] 모델 로드 실패:', error);
            this.hideLoading();
            this.showError(`모델 로드 실패: ${error.message}`);
            
            // 에러 발생 시 다시 모델 선택 화면으로
            setTimeout(() => {
                this.showModelSelector();
            }, 3000);
        }
    }
    
    // 모델 정보 업데이트
    updateModelInfo(info, modelName = '', loadTime = '') {
        console.log('[UIController] 모델 정보 업데이트:', info);
        
        // 모델 이름 표시
        const modelNameEl = document.getElementById('model-name');
        if (modelNameEl && modelName) {
            modelNameEl.textContent = modelName;
        }
        
        // 로드 시간 표시
        const loadTimeEl = document.getElementById('load-time');
        if (loadTimeEl && loadTime) {
            loadTimeEl.textContent = `${loadTime}s`;
        }
        
        // 통계 정보
        if (this.meshCount) this.meshCount.textContent = info.meshCount;
        if (this.vertexCount) this.vertexCount.textContent = info.vertexCount.toLocaleString();
        if (this.triangleCount) this.triangleCount.textContent = info.triangleCount.toLocaleString();
        if (this.hotspotCount) this.hotspotCount.textContent = info.hotspots.length;

        // 카메라 뷰 옵션 업데이트
        if (this.cameraView) {
            this.cameraView.innerHTML = '<option value="default">기본 뷰</option>';
            
            // 프리셋 뷰 추가
            const presetViews = [
                { value: 'front', text: '정면 뷰' },
                { value: 'right', text: '우측 뷰' },
                { value: 'top', text: '상단 뷰' },
                { value: 'isometric', text: '등각 뷰' }
            ];
            
            presetViews.forEach(view => {
                const option = document.createElement('option');
                option.value = view.value;
                option.textContent = view.text;
                this.cameraView.appendChild(option);
            });
            
            // GLTF 카메라 추가
            const gltfCameras = this.modelLoader.getCameras();
            if (gltfCameras && gltfCameras.length > 0) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = 'GLTF 카메라';
                
                gltfCameras.forEach((camera, index) => {
                    const option = document.createElement('option');
                    option.value = `gltf_${index}`;
                    option.textContent = camera.name || `카메라 ${index + 1}`;
                    optgroup.appendChild(option);
                });
                
                this.cameraView.appendChild(optgroup);
                console.log(`[UIController] ${gltfCameras.length}개의 GLTF 카메라 추가됨`);
            }
        }
    }
    
    // 애니메이션 컨트롤 업데이트
    updateAnimationControls() {
        const animControls = document.getElementById('animation-controls') || document.querySelector('.animation-controls');
        const frameControls = document.getElementById('frame-controls') || document.querySelector('.timeline-container');
        
        if (this.animationController.hasAnimations()) {
            if (animControls) animControls.style.display = 'flex';
            if (frameControls) frameControls.style.display = 'flex';
            
            // 타임라인 설정
            if (this.timelineSlider) {
                this.timelineSlider.max = this.animationController.getDuration();
                this.timelineSlider.value = 0;
            }
            
            // 총 시간 표시
            if (this.totalTimeDisplay) {
                this.totalTimeDisplay.textContent = this.formatTime(this.animationController.getDuration());
            }
        } else {
            if (animControls) animControls.style.display = 'none';
            if (frameControls) frameControls.style.display = 'none';
        }
    }
    
    // 애니메이션 토글
    toggleAnimation() {
        if (this.animationController.isPlaying) {
            this.animationController.pause();
            if (this.playBtn) this.playBtn.textContent = '▶️';
        } else {
            this.animationController.play();
            if (this.playBtn) this.playBtn.textContent = '⏸️';
        }
    }
    
    // 컨트롤 패널 토글
    toggleControlPanel() {
        if (this.controlPanel) {
            this.controlPanel.classList.toggle('collapsed');
        }
    }
    
    // 로딩 표시
    showLoading() {
        if (this.loadingScreen) {
            this.loadingScreen.style.display = 'flex';
        }
    }
    
    hideLoading() {
        if (this.loadingScreen) {
            this.loadingScreen.style.display = 'none';
        }
    }
    
    updateProgress(progress) {
        if (this.progressBar) {
            this.progressBar.style.width = `${progress}%`;
        }
        if (this.progressText) {
            this.progressText.textContent = `${Math.round(progress)}%`;
        }
    }
    
    // 에러 표시
    showError(message) {
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.textContent = message;
        errorEl.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 8px;
            z-index: 10000;
        `;
        
        document.body.appendChild(errorEl);
        
        setTimeout(() => {
            errorEl.remove();
        }, 3000);
    }
    
    // FPS 모니터
    startFPSMonitor() {
        setInterval(() => {
            if (this.fpsDisplay) {
                this.fpsDisplay.textContent = this.fps.toFixed(0);
            }
        }, 100);
    }
    
    updateFPS() {
        this.frameCount++;
        const currentTime = performance.now();
        
        if (currentTime >= this.lastTime + 1000) {
            this.fps = (this.frameCount * 1000) / (currentTime - this.lastTime);
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
    }
    
    // 시간 포맷
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    // 애니메이션 프레임 업데이트
    updateAnimationFrame() {
        if (!this.animationController.hasAnimations()) return;
        
        const currentTime = this.animationController.getCurrentTime();
        
        if (this.timelineSlider && !this.timelineSlider.matches(':active')) {
            this.timelineSlider.value = currentTime;
        }
        
        if (this.currentTimeDisplay) {
            this.currentTimeDisplay.textContent = this.formatTime(currentTime);
        }
    }
}