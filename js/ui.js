// js/ui.js - UI 컨트롤러 모듈

export class UIController {
    constructor(config) {
        this.models = config.models || [];
        this.onModelSelect = config.onModelSelect || (() => {});
        this.onViewChange = config.onViewChange || (() => {});
        this.onReset = config.onReset || (() => {});
        
        // DOM 요소
        this.elements = {
            loading: null,
            error: null,
            modelButtons: [],
            viewButtons: [],
            infoContent: null
        };
        
        // 상태
        this.currentModelIndex = -1;
    }
    
    /**
     * UI 초기화
     */
    init() {
        this.cacheElements();
        this.setupEventListeners();
        console.log('✅ UI 컨트롤러 초기화 완료');
    }
    
    /**
     * DOM 요소 캐싱
     */
    cacheElements() {
        // 로딩 & 에러
        this.elements.loading = document.getElementById('loading');
        this.elements.error = document.getElementById('error');
        
        // 모델 버튼
        this.elements.modelButtons = document.querySelectorAll('.model-btn');
        
        // 뷰 컨트롤 버튼
        this.elements.viewButtons = document.querySelectorAll('.control-btn');
        
        // 정보 컨텐츠
        this.elements.infoContent = document.getElementById('info-content');
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 모델 선택 버튼
        this.elements.modelButtons.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                const modelIndex = parseInt(btn.dataset.model);
                this.onModelSelect(modelIndex);
            });
        });
        
        // 뷰 컨트롤 버튼
        this.elements.viewButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                
                if (view === 'reset') {
                    this.onReset();
                } else {
                    this.onViewChange(view);
                }
            });
        });
    }
    
    /**
     * 로딩 화면 표시
     */
    showLoading() {
        if (this.elements.loading) {
            this.elements.loading.style.display = 'flex';
        }
    }
    
    /**
     * 로딩 화면 숨기기
     */
    hideLoading() {
        if (this.elements.loading) {
            this.elements.loading.style.display = 'none';
        }
    }
    
    /**
     * 에러 표시
     */
    showError(message) {
        const errorScreen = this.elements.error;
        if (!errorScreen) return;
        
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
            errorMessage.textContent = message;
        }
        
        errorScreen.style.display = 'flex';
        
        // 5초 후 자동으로 숨기기
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }
    
    /**
     * 에러 숨기기
     */
    hideError() {
        if (this.elements.error) {
            this.elements.error.style.display = 'none';
        }
    }
    
    /**
     * 활성 모델 설정
     */
    setActiveModel(index) {
        this.currentModelIndex = index;
        
        // 모든 버튼에서 active 클래스 제거
        this.elements.modelButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 선택된 버튼에 active 클래스 추가
        this.elements.modelButtons.forEach(btn => {
            if (parseInt(btn.dataset.model) === index) {
                btn.classList.add('active');
            }
        });
    }
    
    /**
     * 모델 정보 업데이트
     */
    updateModelInfo(modelConfig) {
        if (!this.elements.infoContent) return;
        
        this.elements.infoContent.innerHTML = `
            <h3>${modelConfig.name}</h3>
            <p>${modelConfig.description}</p>
            <div style="margin-top: 16px;">
                <p><strong>파일:</strong> ${modelConfig.fileName}</p>
                <p><strong>폴더:</strong> ${modelConfig.folder}/</p>
            </div>
            <div style="margin-top: 16px;">
                <h4>조작법</h4>
                <ul style="list-style: none; padding: 0; color: #b0b0b0; font-size: 0.85rem;">
                    <li>🖱️ 좌클릭 + 드래그: 회전</li>
                    <li>🖱️ 우클릭 + 드래그: 이동</li>
                    <li>🖱️ 스크롤: 확대/축소</li>
                    <li>⌨️ 1-3: 모델 선택</li>
                    <li>⌨️ R: 카메라 리셋</li>
                    <li>⌨️ F: 전체화면</li>
                    <li>⌨️ G: 그리드 토글</li>
                    <li>⌨️ H: 핫스팟 토글</li>
                    <li>⌨️ Space: 애니메이션 재생/정지</li>
                </ul>
            </div>
        `;
    }
    
    /**
     * 모바일 메뉴 토글 (반응형)
     */
    toggleMobileMenu() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open');
        }
    }
    
    /**
     * UI 정리
     */
    destroy() {
        // 이벤트 리스너 제거 등 필요한 정리 작업
        console.log('🔚 UI 컨트롤러 정리');
    }
}