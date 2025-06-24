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
        this.showModelSelector();
        
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
        this.modelToggleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modelType = btn.dataset.model;
                this.selectModelByType(modelType);
                this.updateActiveToggle(btn);
            });
        });
        
        // Panel Toggles
        this.leftPanelToggle.addEventListener('click', () => this.toggleLeftPanel());
        this.rightPanelToggle.addEventListener('click', () => this.toggleRightPanel());
        
        // View Controls
        this.toggleGridBtn.addEventListener('click', () => this.sceneManager.toggleGrid());
        this.toggleHotspotsBtn.addEventListener('click', () => {
            this.hotspotManager.toggleVisibility();
            this.toggleHotspotsBtn.classList.toggle('active');
        });
        
        this.cameraView.addEventListener('change', (e) => {
            this.sceneManager.setCameraView(e.target.value);
        });
        
        // Animation Controls
        this.playBtn.addEventListener('click', () => this.animationController.play());
        this.pauseBtn.addEventListener('click', () => this.animationController.pause());
        this.stopBtn.addEventListener('click', () => this.animationController.reset());
        
        this.timelineSlider.addEventListener('input', (e) => {
            this.animationController.setFrame(parseInt(e.target.value));
        });
        
        this.playbackSpeed.addEventListener('change', (e) => {
            this.animationController.setTimeScale(parseFloat(e.target.value));
        });
        
        this.loopBtn.addEventListener('click', () => {
            this.loopBtn.classList.toggle('active');
            // Toggle loop mode in animation controller
        });
        
        // Brightness Control
        this.brightnessSlider.addEventListener('input', (e) => {
            const brightness = parseFloat(e.target.value);
            this.sceneManager.renderer.toneMappingExposure = brightness;
        });
        
        // Fullscreen
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        
        // Hotspot Click Handler
        this.setupHotspotHandler();
    }
    
    updateActiveToggle(activeBtn) {
        this.modelToggleBtns.forEach(btn => btn.classList.remove('active'));
        activeBtn.classList.add('active');
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
        this.modelSelector.style.display = 'flex';
        this.leftPanel.style.display = 'none';
        this.rightPanel.style.display = 'none';
        document.getElementById('bottom-controls').style.display = 'none';
        
        this.loadModelList();
    }
    
    loadModelList() {
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
        this.modelSelector.style.display = 'none';
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
            this.leftPanel.style.display = 'flex';
            this.rightPanel.style.display = 'flex';
            document.getElementById('bottom-controls').style.display = 'flex';
            
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
        this.modelName.textContent = modelName;
        this.meshCount.textContent = info.meshCount;
        this.vertexCount.textContent = info.vertexCount.toLocaleString();
        this.triangleCount.textContent = info.triangleCount.toLocaleString();
        this.hotspotCount.textContent = info.hotspots.length;
        this.loadTime.textContent = `${loadDuration}s`;
        
        // 카메라 뷰 옵션 업데이트
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
        
        // 애니메이션 컨트롤 표시/숨김
        const hasAnimations = this.animationController.hasAnimations();
        document.querySelector('.animation-controls').style.display = hasAnimations ? 'flex' : 'none';
        document.querySelector('.timeline-container').style.display = hasAnimations ? 'flex' : 'none';
        
        if (hasAnimations) {
            this.timelineSlider.max = Math.floor(this.animationController.duration * this.animationController.fps);
        }
        
        // 핫스팟 생성
        this.hotspotManager.clearHotspots();
        info.hotspots.forEach(hotspot => {
            this.hotspotManager.createHotspot(hotspot.name, hotspot.position, hotspot.userData);
        });
    }
    
    toggleLeftPanel() {
        this.leftPanelCollapsed = !this.leftPanelCollapsed;
        this.leftPanel.classList.toggle('collapsed', this.leftPanelCollapsed);
        this.leftPanelToggle.textContent = this.leftPanelCollapsed ? '▶' : '◀';
    }
    
    toggleRightPanel() {
        this.rightPanelCollapsed = !this.rightPanelCollapsed;
        this.rightPanel.classList.toggle('collapsed', this.rightPanelCollapsed);
        this.rightPanelToggle.textContent = this.rightPanelCollapsed ? '◀' : '▶';
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
        this.selectedHotspot = hotspot;
        
        // 우측 패널 열기
        if (this.rightPanelCollapsed) {
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
            this.fpsDisplay.textContent = this.fps;
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
    }
    
    updateAnimationFrame(frame) {
        this.timelineSlider.value = frame;
        
        const totalFrames = parseInt(this.timelineSlider.max);
        const currentTime = this.formatTime(frame / this.animationController.fps);
        const totalTime = this.formatTime(totalFrames / this.animationController.fps);
        
        this.timelineDisplay.textContent = `${currentTime} / ${totalTime}`;
        
        // Update timeline progress bar
        const progress = (frame / totalFrames) * 100;
        document.querySelector('.timeline-progress').style.width = `${progress}%`;
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            this.fullscreenBtn.innerHTML = '<span>⛶</span>';
        } else {
            document.exitFullscreen();
            this.fullscreenBtn.innerHTML = '<span>⛶</span>';
        }
    }
}

// CSS 추가 스타일 (hotspot-detail 관련)
const additionalStyles = `
<style>
.hotspot-detail-content {
    padding: 20px;
}

.hotspot-detail-content h4 {
    font-size: 18px;
    margin-bottom: 20px;
    color: var(--accent-blue);
}

.hotspot-info {
    margin-bottom: 30px;
}

.info-row {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.info-label {
    color: var(--text-secondary);
    font-size: 14px;
}

.info-value {
    color: var(--text-primary);
    font-weight: 500;
    font-size: 14px;
}

.hotspot-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.action-btn {
    width: 100%;
    padding: 12px;
    background: rgba(0, 123, 255, 0.1);
    border: 1px solid var(--accent-blue);
    border-radius: 8px;
    color: var(--accent-blue);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.3s ease;
}

.action-btn:hover {
    background: rgba(0, 123, 255, 0.2);
}

.control-btn.active,
.control-btn-sm.active {
    background: var(--accent-blue);
    border-color: var(--accent-blue);
}
</style>
`;