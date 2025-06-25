// UIController-improved.js
import { CONFIG } from './config.js';

// CONFIG가 로드되지 않을 경우 기본값 사용
if (typeof CONFIG === 'undefined') {
    window.CONFIG = {
        models: [
            {
                name: '블록 옹벽',
                folder: 'Block_Retaining_Wall',
                fileName: 'Block_Retaining_Wall.gltf',
                icon: '🧱',
                description: '블록식 옹벽 구조'
            }
        ],
        modelsPath: 'gltf/'
    };
}

export class UIControllerImproved {
    constructor(sceneManager, modelLoader, animationController, hotspotManager) {
        this.sceneManager = sceneManager;
        this.modelLoader = modelLoader;
        this.animationController = animationController;
        this.hotspotManager = hotspotManager;
        
        this.fps = 0;
        this.frameCount = 0;
        this.lastTime = performance.now();
        
        this.selectedHotspot = null;
        this.currentModel = null;
        
        this.init();
    }
    
    init() {
        this.cacheDOMElements();
        this.setupEventListeners();
        
        // 패널 초기 상태 설정
        this.leftPanelCollapsed = false;
        this.rightPanelCollapsed = false;
    }
    
    cacheDOMElements() {
        // Header
        this.modelToggleBtns = document.querySelectorAll('.model-toggle-btn');
        this.settingsBtn = document.getElementById('settings-btn');
        this.fullscreenBtn = document.getElementById('fullscreen-btn');
        
        // Panels
        this.leftPanel = document.getElementById('left-panel');
        this.rightPanel = document.getElementById('right-panel');
        this.leftPanelToggle = document.getElementById('left-panel-toggle');
        this.rightPanelToggle = document.getElementById('right-panel-toggle');
        
        // Model Info
        this.modelName = document.getElementById('model-name');
        this.meshCount = document.getElementById('mesh-count');
        this.vertexCount = document.getElementById('vertex-count');
        this.triangleCount = document.getElementById('triangle-count');
        this.hotspotCount = document.getElementById('hotspot-count');
        this.fpsDisplay = document.getElementById('fps');
        this.loadTime = document.getElementById('load-time');
        
        // View Controls
        this.cameraView = document.getElementById('camera-view');
        this.toggleGridBtn = document.getElementById('toggle-grid');
        this.toggleHotspotsBtn = document.getElementById('toggle-hotspots');
        
        // Bottom Controls
        this.playBtn = document.getElementById('play-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.timelineSlider = document.getElementById('timeline-slider');
        this.timelineDisplay = document.getElementById('timeline-display');
        this.playbackSpeed = document.getElementById('playback-speed');
        this.loopBtn = document.getElementById('loop-btn');
        this.brightnessSlider = document.getElementById('brightness-slider');
        
        // Other
        this.modelSelector = document.getElementById('model-selector');
        this.modelList = document.getElementById('model-list');
        this.hotspotDetail = document.getElementById('hotspot-detail');
    }
    
    setupEventListeners() {
        // Model Toggle Buttons
        if (this.modelToggleBtns) {
            this.modelToggleBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const modelType = btn.dataset.model;
                    this.selectModelByType(modelType);
                    this.updateActiveToggle(btn);
                });
            });
        }
        
        // Panel Toggles - NULL 체크 추가
        if (this.leftPanelToggle) {
            this.leftPanelToggle.addEventListener('click', () => this.toggleLeftPanel());
        }
        if (this.rightPanelToggle) {
            this.rightPanelToggle.addEventListener('click', () => this.toggleRightPanel());
        }
        
        // View Controls - NULL 체크 추가
        if (this.toggleGridBtn) {
            this.toggleGridBtn.addEventListener('click', () => {
                this.sceneManager.toggleGrid();
                this.toggleGridBtn.classList.toggle('active');
            });
        }
        
        if (this.toggleHotspotsBtn) {
            this.toggleHotspotsBtn.addEventListener('click', () => {
                this.hotspotManager.toggleVisibility();
                this.toggleHotspotsBtn.classList.toggle('active');
            });
        }
        
        if (this.cameraView) {
            this.cameraView.addEventListener('change', (e) => {
                this.sceneManager.setCameraView(e.target.value);
            });
        }
        
        // Animation Controls - NULL 체크 추가
        if (this.playBtn) {
            this.playBtn.addEventListener('click', () => this.animationController.play());
        }
        if (this.pauseBtn) {
            this.pauseBtn.addEventListener('click', () => this.animationController.pause());
        }
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => this.animationController.reset());
        }
        
        if (this.timelineSlider) {
            this.timelineSlider.addEventListener('input', (e) => {
                this.animationController.setFrame(parseInt(e.target.value));
            });
        }
        
        if (this.playbackSpeed) {
            this.playbackSpeed.addEventListener('change', (e) => {
                this.animationController.setTimeScale(parseFloat(e.target.value));
            });
        }
        
        if (this.loopBtn) {
            this.loopBtn.addEventListener('click', () => {
                this.loopBtn.classList.toggle('active');
                // Toggle loop mode in animation controller
            });
        }
        
        // Brightness Control - NULL 체크 추가
        if (this.brightnessSlider) {
            this.brightnessSlider.addEventListener('input', (e) => {
                const brightness = parseFloat(e.target.value);
                this.sceneManager.renderer.toneMappingExposure = brightness;
            });
        }
        
        // Fullscreen - NULL 체크 추가
        if (this.fullscreenBtn) {
            this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }
        
        // Hotspot Click Handler
        this.setupHotspotHandler();
    }
    
    updateActiveToggle(activeBtn) {
        if (this.modelToggleBtns) {
            this.modelToggleBtns.forEach(btn => btn.classList.remove('active'));
        }
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }
    
    selectModelByType(modelType) {
        const modelMap = {
            'block': CONFIG.models[0],
            'cantilever': CONFIG.models[1],
            'mse': CONFIG.models[2]
        };
        
        const model = modelMap[modelType];
        if (model) {
            this.selectModel(model);
        }
    }
    
    showModelSelector() {
        if (this.modelSelector) {
            this.modelSelector.style.display = 'flex';
        }
        if (this.leftPanel) {
            this.leftPanel.style.display = 'none';
        }
        if (this.rightPanel) {
            this.rightPanel.style.display = 'none';
        }
        
        const bottomControls = document.getElementById('bottom-controls');
        if (bottomControls) {
            bottomControls.style.display = 'none';
        }
        
        this.loadModelList();
    }
    
    loadModelList() {
        if (!this.modelList) {
            console.error('[UIController] modelList 요소를 찾을 수 없습니다');
            return;
        }
        
        if (!CONFIG.models || CONFIG.models.length === 0) {
            this.modelList.innerHTML = '<p style="color: #ff6b6b;">사용 가능한 모델이 없습니다.</p>';
            return;
        }
        
        this.modelList.innerHTML = '';
        CONFIG.models.forEach(model => {
            const card = document.createElement('div');
            card.className = 'model-card';
            card.innerHTML = `
                <div class="model-icon">${model.icon}</div>
                <div class="model-name">${model.name}</div>
                <div class="model-info">${model.description}</div>
            `;
            card.addEventListener('click', () => this.selectModel(model));
            this.modelList.appendChild(card);
        });
    }
    
    async selectModel(model) {
        if (this.modelSelector) {
            this.modelSelector.style.display = 'none';
        }
        this.currentModel = model;
        
        const startTime = performance.now();
        
        try {
            if (!model.fileName) {
                throw new Error(`'${model.name}' 모델의 fileName이 지정되지 않았습니다.`);
            }
            
            const modelPath = `${CONFIG.modelsPath}${model.folder}/${model.fileName}`;
            const gltf = await this.modelLoader.loadGLTF(modelPath);
            
            const loadEndTime = performance.now();
            const loadDuration = ((loadEndTime - startTime) / 1000).toFixed(2);
            
            this.updateModelInfo(gltf.userData.modelInfo, model.name, loadDuration);
            
            // UI 표시
            if (this.leftPanel) {
                this.leftPanel.style.display = 'flex';
            }
            if (this.rightPanel) {
                this.rightPanel.style.display = 'flex';
            }
            
            const bottomControls = document.getElementById('bottom-controls');
            if (bottomControls) {
                bottomControls.style.display = 'flex';
            }
            
            // 해당 모델의 토글 버튼 활성화
            const modelTypeMap = {
                '블록 옹벽': 'block',
                '캔틸레버 옹벽': 'cantilever',
                'MSE 옹벽': 'mse'
            };
            const modelType = modelTypeMap[model.name];
            const toggleBtn = document.querySelector(`[data-model="${modelType}"]`);
            if (toggleBtn) {
                this.updateActiveToggle(toggleBtn);
            }
            
        } catch (error) {
            console.error('모델 로드 실패:', error);
            this.modelLoader.showError(`모델 로드 실패: ${error.message}`);
            this.showModelSelector();
        }
    }
    
    updateModelInfo(info, modelName, loadDuration) {
        // NULL 체크 추가
        if (this.modelName) this.modelName.textContent = modelName;
        if (this.meshCount) this.meshCount.textContent = info.meshCount;
        if (this.vertexCount) this.vertexCount.textContent = info.vertexCount.toLocaleString();
        if (this.triangleCount) this.triangleCount.textContent = info.triangleCount.toLocaleString();
        if (this.hotspotCount) this.hotspotCount.textContent = info.hotspots.length;
        if (this.loadTime) this.loadTime.textContent = `${loadDuration}s`;
        
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
            }
        }
        
        // 애니메이션 컨트롤 표시/숨김
        const hasAnimations = this.animationController.hasAnimations();
        const animationControls = document.querySelector('.animation-controls');
        const timelineContainer = document.querySelector('.timeline-container');
        
        if (animationControls) {
            animationControls.style.display = hasAnimations ? 'flex' : 'none';
        }
        if (timelineContainer) {
            timelineContainer.style.display = hasAnimations ? 'flex' : 'none';
        }
        
        if (hasAnimations && this.timelineSlider) {
            this.timelineSlider.max = Math.floor(this.animationController.duration * this.animationController.fps);
        }
        
        // 핫스팟 생성
        this.hotspotManager.clearHotspots();
        info.hotspots.forEach(hotspot => {
            this.hotspotManager.createHotspot(hotspot.name, hotspot.position, hotspot.userData);
        });
    }
    
    toggleLeftPanel() {
        if (!this.leftPanel) return;
        
        this.leftPanelCollapsed = !this.leftPanelCollapsed;
        this.leftPanel.classList.toggle('collapsed', this.leftPanelCollapsed);
        
        if (this.leftPanelToggle) {
            this.leftPanelToggle.textContent = this.leftPanelCollapsed ? '▶' : '◀';
        }
    }
    
    toggleRightPanel() {
        if (!this.rightPanel) return;
        
        this.rightPanelCollapsed = !this.rightPanelCollapsed;
        this.rightPanel.classList.toggle('collapsed', this.rightPanelCollapsed);
        
        if (this.rightPanelToggle) {
            this.rightPanelToggle.textContent = this.rightPanelCollapsed ? '◀' : '▶';
        }
    }
    
    setupHotspotHandler() {
        // HotspotManager에서 이벤트를 받아 처리
        if (this.hotspotManager) {
            this.hotspotManager.onHotspotClick = (hotspot) => {
                this.showHotspotDetail(hotspot);
            };
        }
    }
    
    showHotspotDetail(hotspot) {
        if (!this.hotspotDetail) return;
        
        this.selectedHotspot = hotspot;
        
        // 우측 패널 열기
        if (this.rightPanelCollapsed && this.rightPanel) {
            this.toggleRightPanel();
        }
        
        // 핫스팟 상세 정보 표시
        let detailHTML = `
            <div class="hotspot-detail-content">
                <h4>${hotspot.name}</h4>
                <div class="hotspot-info">
        `;
        
        // userData의 정보를 표시
        if (hotspot.userData) {
            Object.entries(hotspot.userData).forEach(([key, value]) => {
                if (key !== 'icon' && key !== 'title') {
                    detailHTML += `
                        <div class="info-row">
                            <span class="info-label">${this.formatLabel(key)}:</span>
                            <span class="info-value">${value}</span>
                        </div>
                    `;
                }
            });
        }
        
        detailHTML += `
                </div>
                <div class="hotspot-actions">
                    <button class="action-btn" onclick="alert('상세 분석 기능은 준비중입니다.')">
                        📊 상세 분석
                    </button>
                    <button class="action-btn" onclick="alert('리포트 생성 기능은 준비중입니다.')">
                        📄 리포트 생성
                    </button>
                </div>
            </div>
        `;
        
        this.hotspotDetail.innerHTML = detailHTML;
    }
    
    formatLabel(key) {
        // camelCase를 한글로 변환하는 매핑
        const labelMap = {
            'status': '상태',
            'lastInspection': '최근 점검일',
            'riskLevel': '위험도',
            'material': '재질',
            'height': '높이',
            'length': '길이',
            'angle': '각도'
        };
        
        return labelMap[key] || key;
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
        if (this.timelineSlider) {
            this.timelineSlider.value = frame;
        }
        
        if (this.timelineSlider && this.timelineDisplay) {
            const totalFrames = parseInt(this.timelineSlider.max);
            const currentTime = this.formatTime(frame / this.animationController.fps);
            const totalTime = this.formatTime(totalFrames / this.animationController.fps);
            
            this.timelineDisplay.textContent = `${currentTime} / ${totalTime}`;
        }
        
        // Update timeline progress bar
        const progressBar = document.querySelector('.timeline-progress');
        if (progressBar && this.timelineSlider) {
            const totalFrames = parseInt(this.timelineSlider.max);
            const progress = (frame / totalFrames) * 100;
            progressBar.style.width = `${progress}%`;
        }
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            if (this.fullscreenBtn) {
                this.fullscreenBtn.innerHTML = '<span>⛕</span>';
            }
        } else {
            document.exitFullscreen();
            if (this.fullscreenBtn) {
                this.fullscreenBtn.innerHTML = '<span>⛶</span>';
            }
        }
    }
}