// UIController.js - viewer.html과 index.html 모두 호환
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
    
 // UIController.js에 추가할 카메라 컨트롤 개선 코드

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
    
    // 회전 뷰 버튼 (클릭할 때마다 90도씩 회전)
    let currentOrbitAngle = 0;
    const orbitViewBtn = document.getElementById('orbit-view');
    if (orbitViewBtn) {
        orbitViewBtn.addEventListener('click', () => {
            currentOrbitAngle = (currentOrbitAngle + 90) % 360;
            this.showCameraTransitionIndicator(`${currentOrbitAngle}° 회전`);
            this.sceneManager.setCameraView(`orbit-${currentOrbitAngle}`, {
                duration: 1.5,
                easeType: 'easeInOutSine'
            });
        });
    }
    
    // 줌 버튼 추가
    this.createZoomControls();
    
    // 카메라 전환 속도 설정
    const cameraSpeed = document.getElementById('camera-speed');
    if (cameraSpeed) {
        cameraSpeed.addEventListener('change', (e) => {
            const duration = parseFloat(e.target.value);
            this.sceneManager.setCameraTransitionDuration(duration);
        });
    }
    
    // 이징 타입 선택 추가
    this.createEasingSelector();
    
    // 키보드 단축키 개선
    this.setupKeyboardShortcuts();
    
    // 카메라 전환 이벤트 리스너
    if (this.sceneManager) {
        this.sceneManager.onCameraTransitionStart = (viewName) => {
            this.disableInteractionDuringTransition();
        };
        
        this.sceneManager.onCameraTransitionEnd = (viewName) => {
            this.enableInteractionAfterTransition();
            this.hideCameraTransitionIndicator();
        };
    }
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
            this.sceneManager.setCameraView(view, {
                duration: 1.0,
                priority: 'high'
            });
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
    
    // 줌 이벤트
    document.getElementById('zoom-in').addEventListener('click', () => {
        this.sceneManager.setCameraView('zoom-in', { duration: 0.5 });
    });
    
    document.getElementById('zoom-out').addEventListener('click', () => {
        this.sceneManager.setCameraView('zoom-out', { duration: 0.5 });
    });
    
    document.getElementById('zoom-fit').addEventListener('click', () => {
        this.sceneManager.setCameraView('focus-model', { duration: 1.0 });
    });
}

// 이징 선택기 생성
createEasingSelector() {
    const viewControls = document.querySelector('.view-controls');
    if (!viewControls) return;
    
    const easingContainer = document.createElement('div');
    easingContainer.className = 'easing-control';
    easingContainer.innerHTML = `
        <label>전환 효과:</label>
        <select id="camera-easing" class="camera-select-sm">
            <option value="linear">선형</option>
            <option value="easeInOutCubic" selected>부드럽게</option>
            <option value="easeOutElastic">탄성</option>
            <option value="easeInOutSine">사인파</option>
        </select>
    `;
    
    viewControls.appendChild(easingContainer);
    
    document.getElementById('camera-easing').addEventListener('change', (e) => {
        this.sceneManager.setCameraTransitionEasing(e.target.value);
    });
}

// 키보드 단축키 설정
setupKeyboardShortcuts() {
    const keyMap = {
        '1': () => this.sceneManager.setCameraView('default'),
        '2': () => this.sceneManager.setCameraView('focus-model'),
        '3': () => this.sceneManager.setCameraView('front'),
        '4': () => this.sceneManager.setCameraView('right'),
        '5': () => this.sceneManager.setCameraView('top'),
        '6': () => this.sceneManager.setCameraView('isometric'),
        'r': () => this.rotateCamera(),
        'R': () => this.rotateCamera(true),
        '+': () => this.sceneManager.setCameraView('zoom-in'),
        '-': () => this.sceneManager.setCameraView('zoom-out'),
        'f': () => this.sceneManager.setCameraView('focus-model'),
        'Escape': () => this.sceneManager.cancelCameraTransition()
    };
    
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        const action = keyMap[e.key];
        if (action) {
            e.preventDefault();
            action();
        }
    });
}

// 카메라 회전
rotateCamera(reverse = false) {
    const angle = reverse ? -90 : 90;
    const currentAngle = parseInt(this.currentOrbitAngle || 0);
    const newAngle = (currentAngle + angle + 360) % 360;
    this.currentOrbitAngle = newAngle;
    
    this.showCameraTransitionIndicator(`${newAngle}° 회전`);
    this.sceneManager.setCameraView(`orbit-${newAngle}`);
}

// 카메라 전환 중 표시
showCameraTransitionIndicator(message) {
    if (!this.cameraTransitionIndicator) {
        this.cameraTransitionIndicator = document.createElement('div');
        this.cameraTransitionIndicator.className = 'camera-transition-indicator';
        this.cameraTransitionIndicator.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 123, 255, 0.9);
            color: white;
            padding: 12px 24px;
            border-radius: 24px;
            font-size: 14px;
            pointer-events: none;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(this.cameraTransitionIndicator);
    }
    
    this.cameraTransitionIndicator.textContent = message;
    this.cameraTransitionIndicator.style.opacity = '1';
}

// 카메라 전환 표시 숨기기
hideCameraTransitionIndicator() {
    if (this.cameraTransitionIndicator) {
        this.cameraTransitionIndicator.style.opacity = '0';
    }
}

// 전환 중 상호작용 비활성화
disableInteractionDuringTransition() {
    // 버튼들 비활성화
    document.querySelectorAll('.view-btn, .preset-btn, .zoom-btn').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
    });
}

// 전환 후 상호작용 재활성화
enableInteractionAfterTransition() {
    // 버튼들 재활성화
    document.querySelectorAll('.view-btn, .preset-btn, .zoom-btn').forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
    });
}

// 카메라 상태 저장/복원 UI
createCameraStateControls() {
    const savedStates = new Map();
    let stateCounter = 0;
    
    const stateContainer = document.createElement('div');
    stateContainer.className = 'camera-state-controls';
    stateContainer.innerHTML = `
        <h5>카메라 상태</h5>
        <button id="save-camera-state" class="control-btn-sm">
            💾 현재 뷰 저장
        </button>
        <div id="saved-states-list"></div>
    `;
    
    document.querySelector('.view-controls').appendChild(stateContainer);
    
    // 상태 저장
    document.getElementById('save-camera-state').addEventListener('click', () => {
        const state = this.sceneManager.saveCameraState();
        if (state) {
            const stateId = `state_${++stateCounter}`;
            savedStates.set(stateId, {
                ...state,
                name: `뷰 ${stateCounter}`,
                timestamp: new Date()
            });
            this.updateSavedStatesList(savedStates);
        }
    });
}

// 저장된 상태 목록 업데이트
updateSavedStatesList(savedStates) {
    const listEl = document.getElementById('saved-states-list');
    listEl.innerHTML = '';
    
    savedStates.forEach((state, id) => {
        const stateEl = document.createElement('div');
        stateEl.className = 'saved-state-item';
        stateEl.innerHTML = `
            <span>${state.name}</span>
            <button class="restore-btn" data-state="${id}">복원</button>
            <button class="delete-btn" data-state="${id}">❌</button>
        `;
        
        stateEl.querySelector('.restore-btn').addEventListener('click', () => {
            this.showCameraTransitionIndicator(`${state.name} 복원`);
            this.sceneManager.restoreCameraState(state, { duration: 1.0 });
        });
        
        stateEl.querySelector('.delete-btn').addEventListener('click', () => {
            savedStates.delete(id);
            this.updateSavedStatesList(savedStates);
        });
        
        listEl.appendChild(stateEl);
    });
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
        
        // viewer.html 호환성을 위한 대체 요소 확인
        this.controlPanel = document.getElementById('control-panel') || document.getElementById('bottom-controls');
        this.infoPanel = document.getElementById('info-panel') || document.getElementById('left-panel');
        
        // 컨트롤 요소들 - viewer.html 호환성 추가
        this.playBtn = document.getElementById('playBtn') || document.getElementById('play-btn');
        this.pauseBtn = document.getElementById('pauseBtn') || document.getElementById('pause-btn');
        this.resetBtn = document.getElementById('resetBtn') || document.getElementById('stop-btn');
        this.frameSlider = document.getElementById('frameSlider') || document.getElementById('timeline-slider');
        this.frameDisplay = document.getElementById('frameDisplay') || document.getElementById('timeline-display');
        this.toggleHotspotsBtn = document.getElementById('toggleHotspots') || document.getElementById('toggle-hotspots');
        this.toggleGridBtn = document.getElementById('toggleGrid') || document.getElementById('toggle-grid');
        this.cameraView = document.getElementById('cameraView') || document.getElementById('camera-view');
        
        // 정보 표시 요소들 - viewer.html 호환성 추가
        this.meshCount = document.getElementById('meshCount') || document.getElementById('mesh-count');
        this.vertexCount = document.getElementById('vertexCount') || document.getElementById('vertex-count');
        this.triangleCount = document.getElementById('triangleCount') || document.getElementById('triangle-count');
        this.hotspotCount = document.getElementById('hotspotCount') || document.getElementById('hotspot-count');
        this.fpsDisplay = document.getElementById('fps');
        
        // 로딩/에러 요소들
        this.loading = document.getElementById('loading');
        this.error = document.getElementById('error');
    }
    
    verifyDOMElements() {
        const criticalElements = {
            'modelSelector': this.modelSelector,
            'modelList': this.modelList
        };
        
        const optionalElements = {
            'controlPanel': this.controlPanel,
            'infoPanel': this.infoPanel,
            'changeModelBtn': this.changeModelBtn
        };
        
        const missing = [];
        Object.entries(criticalElements).forEach(([name, element]) => {
            if (!element) {
                missing.push(name);
            }
        });
        
        if (missing.length > 0) {
            console.error('[UIController] 필수 DOM 요소 누락:', missing);
        }
        
        // 선택적 요소는 경고만
        const missingOptional = [];
        Object.entries(optionalElements).forEach(([name, element]) => {
            if (!element) {
                missingOptional.push(name);
            }
        });
        
        if (missingOptional.length > 0) {
            console.warn('[UIController] 선택적 DOM 요소 누락:', missingOptional);
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
            // 핫스팟은 기본적으로 보이므로 active 클래스 추가
            this.toggleHotspotsBtn.classList.add('active');
            this.toggleHotspotsBtn.addEventListener('click', () => {
                this.hotspotManager.toggleVisibility();
                this.toggleHotspotsBtn.classList.toggle('active');
            });
        }
        if (this.toggleGridBtn) {
            this.toggleGridBtn.addEventListener('click', () => {
                this.sceneManager.toggleGrid();
                this.toggleGridBtn.classList.toggle('active');
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
        
        // viewer.html 추가 컨트롤들
        const playbackSpeed = document.getElementById('playback-speed');
        if (playbackSpeed) {
            playbackSpeed.addEventListener('change', (e) => {
                this.animationController.setTimeScale(parseFloat(e.target.value));
            });
        }
        
        const loopBtn = document.getElementById('loop-btn');
        if (loopBtn) {
            loopBtn.addEventListener('click', () => {
                loopBtn.classList.toggle('active');
                // TODO: 루프 모드 토글 구현
            });
        }
        
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen();
                } else {
                    document.exitFullscreen();
                }
            });
        }
    }
    
    setupSliderListeners() {
        // 밝기 슬라이더 - viewer.html과 index.html 모두 지원
        const brightnessSlider = document.getElementById('brightnessSlider') || document.getElementById('brightness-slider');
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
        
        // viewer.html용 추가 요소들 숨기기
        const bottomControls = document.getElementById('bottom-controls');
        if (bottomControls) bottomControls.style.display = 'none';
        
        const rightPanel = document.getElementById('right-panel');
        if (rightPanel) rightPanel.style.display = 'none';
        
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
        
        const startTime = performance.now();
        
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
            
            // 로드 시간 계산
            const loadEndTime = performance.now();
            const loadDuration = ((loadEndTime - startTime) / 1000).toFixed(2);
            
            // 모델 정보 업데이트 - 모델 이름과 로드 시간도 전달
            this.updateModelInfo(gltf.userData.modelInfo, model.name, loadDuration);
            
            // UI 패널 표시
            if (this.controlPanel) this.controlPanel.style.display = 'block';
            if (this.infoPanel) this.infoPanel.style.display = 'block';
            if (this.changeModelBtn) this.changeModelBtn.style.display = 'block';
            
            // viewer.html용 추가 요소들 표시
            const bottomControls = document.getElementById('bottom-controls');
            if (bottomControls) bottomControls.style.display = 'flex';
            
            const rightPanel = document.getElementById('right-panel');
            if (rightPanel) rightPanel.style.display = 'flex';
            
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

    updateModelInfo(info, modelName = '', loadDuration = '') {
        console.log('[UIController] 모델 정보 업데이트:', info);
        
        // 정보 표시 업데이트
        // viewer.html에는 model-name도 있을 수 있음
        const modelNameEl = document.getElementById('model-name');
        if (modelNameEl && modelName) {
            modelNameEl.textContent = modelName;
        }
        
        // 로드 시간 표시
        const loadTimeEl = document.getElementById('load-time');
        if (loadTimeEl && loadDuration) {
            loadTimeEl.textContent = `${loadDuration}s`;
        }
        
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
        const animControls = document.getElementById('animation-controls') || document.querySelector('.animation-controls');
        const frameControls = document.getElementById('frame-controls') || document.querySelector('.timeline-container');
        
        if (this.animationController.hasAnimations()) {
            if (animControls) animControls.style.display = animControls.classList ? 'flex' : 'block';
            if (frameControls) frameControls.style.display = frameControls.classList ? 'flex' : 'block';
            
            // 프레임 슬라이더 최대값 설정
            if (this.frameSlider) {
                const maxFrames = this.animationController.getMaxFrames();
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
            // viewer.html의 timeline-display 형식 지원
            if (this.frameDisplay.id === 'timeline-display' && this.animationController) {
                const currentTime = frame / this.animationController.fps;
                const totalTime = this.animationController.getDuration();
                const formatTime = (seconds) => {
                    const mins = Math.floor(seconds / 60);
                    const secs = Math.floor(seconds % 60);
                    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                };
                this.frameDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(totalTime)}`;
            } else {
                // 기본 형식 (index.html)
                this.frameDisplay.textContent = frame;
            }
        }
    }
}