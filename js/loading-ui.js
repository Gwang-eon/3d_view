// js/loading-ui.js - 프로그레시브 로딩 UI 컴포넌트

export class LoadingUI {
    constructor() {
        this.container = null;
        this.elements = {};
        this.currentStage = null;
        
        // 로딩 단계 정의
        this.stages = [
            { id: 'preview', label: '프리뷰' },
            { id: 'model', label: '모델' },
            { id: 'optimize', label: '최적화' },
            { id: 'complete', label: '완료' }
        ];
        
        this.init();
    }
    
    /**
     * 초기화
     */
    init() {
        this.createDOM();
        this.cacheElements();
    }
    
    /**
     * DOM 생성
     */
    createDOM() {
        // 기존 컨테이너 제거
        const existing = document.getElementById('loading-enhanced');
        if (existing) existing.remove();
        
        // HTML 생성
        const html = `
            <div id="loading-enhanced" class="loading-enhanced">
                <div class="loading-content">
                    <!-- 프리뷰 영역 -->
                    <div class="loading-preview">
                        <div class="loading-skeleton"></div>
                        <img id="loading-preview-img" alt="모델 프리뷰">
                    </div>
                    
                    <!-- 로딩 정보 -->
                    <div class="loading-info">
                        <h3 class="loading-title" id="loading-title">3D 모델 로딩 중</h3>
                        <p class="loading-subtitle" id="loading-subtitle">잠시만 기다려주세요...</p>
                        
                        <!-- 진행률 -->
                        <div class="loading-progress-text">
                            진행률: <span class="percentage" id="loading-percentage">0%</span>
                        </div>
                        <div class="loading-progress-container">
                            <div class="loading-progress-bar" id="loading-progress"></div>
                        </div>
                        
                        <!-- 단계 인디케이터 -->
                        <div class="loading-stages" id="loading-stages">
                            ${this.stages.map(stage => `
                                <div class="loading-stage" data-stage="${stage.id}">
                                    <div class="loading-stage-dot"></div>
                                    <div class="loading-stage-label">${stage.label}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <!-- 에러 메시지 (숨김) -->
                    <div class="loading-error" id="loading-error" style="display: none;">
                        <div class="loading-error-icon">⚠️</div>
                        <div class="loading-error-message" id="loading-error-message"></div>
                    </div>
                </div>
            </div>
        `;
        
        // DOM에 추가
        document.body.insertAdjacentHTML('beforeend', html);
        this.container = document.getElementById('loading-enhanced');
    }
    
    /**
     * 요소 캐싱
     */
    cacheElements() {
        this.elements = {
            container: this.container,
            previewImg: document.getElementById('loading-preview-img'),
            title: document.getElementById('loading-title'),
            subtitle: document.getElementById('loading-subtitle'),
            percentage: document.getElementById('loading-percentage'),
            progressBar: document.getElementById('loading-progress'),
            stages: document.getElementById('loading-stages'),
            error: document.getElementById('loading-error'),
            errorMessage: document.getElementById('loading-error-message')
        };
    }
    
    /**
     * 로딩 표시
     */
    show(modelName = '') {
        this.reset();
        this.container.classList.add('show');
        
        if (modelName) {
            this.elements.title.textContent = `${modelName} 로딩 중`;
        }
    }
    
    /**
     * 로딩 숨김
     */
    hide() {
        this.container.classList.remove('show');
        setTimeout(() => this.reset(), 300);
    }
    
    /**
     * 프리뷰 이미지 설정
     */
    setPreview(imageUrl) {
        if (!imageUrl) return;
        
        const img = this.elements.previewImg;
        img.onload = () => {
            img.classList.add('loaded');
        };
        img.src = imageUrl;
    }
    
    /**
     * 진행률 업데이트
     */
    updateProgress(percentage) {
        percentage = Math.min(100, Math.max(0, percentage));
        this.elements.percentage.textContent = `${Math.round(percentage)}%`;
        this.elements.progressBar.style.width = `${percentage}%`;
    }
    
    /**
     * 상태 업데이트
     */
    updateState(state) {
        const stateMessages = {
            'idle': '준비 중...',
            'preview-loading': '프리뷰 로드 중...',
            'preview-loaded': '프리뷰 로드 완료',
            'model-loading': '3D 모델 다운로드 중...',
            'model-processing': '모델 최적화 중...',
            'complete': '로드 완료!',
            'error': '로드 중 오류 발생'
        };
        
        this.elements.subtitle.textContent = stateMessages[state] || state;
        
        // 단계 업데이트
        this.updateStages(state);
        
        // 에러 상태 처리
        if (state === 'error') {
            this.showError('모델을 로드할 수 없습니다. 다시 시도해주세요.');
        }
    }
    
    /**
     * 단계 인디케이터 업데이트
     */
    updateStages(state) {
        const stageMap = {
            'preview-loading': 'preview',
            'preview-loaded': 'preview',
            'model-loading': 'model',
            'model-processing': 'optimize',
            'complete': 'complete'
        };
        
        const currentStageId = stageMap[state];
        if (!currentStageId) return;
        
        const stages = this.container.querySelectorAll('.loading-stage');
        let foundCurrent = false;
        
        stages.forEach(stage => {
            const stageId = stage.dataset.stage;
            
            if (stageId === currentStageId) {
                stage.classList.add('active');
                stage.classList.remove('completed');
                foundCurrent = true;
            } else if (!foundCurrent) {
                stage.classList.remove('active');
                stage.classList.add('completed');
            } else {
                stage.classList.remove('active', 'completed');
            }
        });
    }
    
    /**
     * 에러 표시
     */
    showError(message) {
        this.elements.error.style.display = 'block';
        this.elements.errorMessage.textContent = message;
        this.elements.progressBar.style.background = 'var(--accent-red)';
    }
    
    /**
     * 리셋
     */
    reset() {
        this.updateProgress(0);
        this.elements.previewImg.classList.remove('loaded');
        this.elements.previewImg.src = '';
        this.elements.title.textContent = '3D 모델 로딩 중';
        this.elements.subtitle.textContent = '잠시만 기다려주세요...';
        this.elements.error.style.display = 'none';
        this.elements.progressBar.style.background = '';
        
        // 모든 단계 리셋
        const stages = this.container.querySelectorAll('.loading-stage');
        stages.forEach(stage => {
            stage.classList.remove('active', 'completed');
        });
    }
}

// 전역 인스턴스 생성
export const loadingUI = new LoadingUI();