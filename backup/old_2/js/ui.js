// js/ui.js - 새로운 UI 컨트롤러 모듈 (아이콘 시스템 적용)

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
            helpBox: null,
            cameraBox: null,
            hotspotBox: null,
            timeline: null
        };
        
        // 상태
        this.currentModelIndex = -1;
        this.isHelpOpen = false;
        this.isSpeedControlOpen = false;
        this.isHotspotBoxOpen = false;
    }
    
    /**
     * UI 초기화
     */
    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.initFloatingBoxes();
        console.log('✅ UI 컨트롤러 초기화 완료');
    }
    
    /**
     * DOM 요소 캐싱
     */
    cacheElements() {
        // 로딩 & 에러
        this.elements.loading = document.getElementById('loading');
        this.elements.error = document.getElementById('error');
        
        // 모델 버튼 (상단)
        this.elements.modelButtons = document.querySelectorAll('.model-btn-top');
        
        // 뷰 컨트롤 버튼
        this.elements.viewButtons = document.querySelectorAll('.view-btn');
        
        // 플로팅 박스
        this.elements.helpBox = document.getElementById('help-floating');
        this.elements.cameraBox = document.getElementById('camera-floating');
        this.elements.hotspotBox = document.getElementById('hotspot-floating');
        
        // 타임라인
        this.elements.timeline = document.getElementById('animation-timeline');
        this.elements.playBtn = document.getElementById('play-btn');
        this.elements.timelineSlider = document.getElementById('timeline-slider');
        this.elements.currentTime = document.getElementById('current-time');
        this.elements.totalTime = document.getElementById('total-time');
        this.elements.timelineProgress = document.querySelector('.timeline-progress');
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 모델 선택 버튼
        this.elements.modelButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const modelIndex = parseInt(btn.dataset.model);
                this.onModelSelect(modelIndex);
            });
        });
        
        // 뷰 컨트롤 버튼
        this.elements.viewButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.onViewChange(view);
            });
        });
        
        // 카메라 리셋 버튼
        const resetBtn = document.querySelector('.reset-camera-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.onReset();
            });
        }
        
        // 핫스팟 토글 버튼 (헤더)
        const hotspotToggleBtn = document.getElementById('hotspot-toggle-btn');
        if (hotspotToggleBtn) {
            hotspotToggleBtn.addEventListener('click', () => {
                this.toggleHotspotBox();
            });
        }
        
        // 속도 조절 토글
        const speedToggle = document.querySelector('.speed-toggle');
        if (speedToggle) {
            speedToggle.addEventListener('click', () => {
                this.toggleSpeedControls();
            });
        }
        
        // 타임라인 슬라이더
        if (this.elements.timelineSlider) {
            this.elements.timelineSlider.addEventListener('input', (e) => {
                this.onTimelineSeek(e.target.value);
            });
        }
        
        // 재생 버튼
        if (this.elements.playBtn) {
            this.elements.playBtn.addEventListener('click', () => {
                this.onPlayClick();
            });
        }
    }
    
    /**
     * 플로팅 박스 초기화
     */
    initFloatingBoxes() {
        // 조작법 박스
        const helpToggle = this.elements.helpBox?.querySelector('.floating-toggle');
        if (helpToggle) {
            helpToggle.addEventListener('click', () => {
                this.toggleHelpBox();
            });
        }
        
        // 핫스팟 박스 닫기 버튼
        const hotspotClose = this.elements.hotspotBox?.querySelector('.floating-close');
        if (hotspotClose) {
            hotspotClose.addEventListener('click', () => {
                this.hideHotspotBox();
            });
        }
        
        // 속도 슬라이더 값 표시
        this.initSpeedSliders();
    }
    
    /**
     * 속도 슬라이더 초기화
     */
    initSpeedSliders() {
        const sliders = [
            { id: 'camera-rotate-speed', valueId: 'rotate-speed-value' },
            { id: 'camera-zoom-speed', valueId: 'zoom-speed-value' },
            { id: 'camera-pan-speed', valueId: 'pan-speed-value' }
        ];
        
        sliders.forEach(({ id, valueId }) => {
            const slider = document.getElementById(id);
            const valueDisplay = document.getElementById(valueId);
            
            if (slider && valueDisplay) {
                slider.addEventListener('input', (e) => {
                    valueDisplay.textContent = e.target.value;
                });
            }
        });
    }
    
    /**
     * 조작법 박스 토글
     */
    toggleHelpBox() {
        this.isHelpOpen = !this.isHelpOpen;
        if (this.elements.helpBox) {
            this.elements.helpBox.classList.toggle('open', this.isHelpOpen);
        }
    }
    
    /**
     * 속도 컨트롤 토글
     */
    toggleSpeedControls() {
        this.isSpeedControlOpen = !this.isSpeedControlOpen;
        const speedToggle = document.querySelector('.speed-toggle');
        const speedControls = document.querySelector('.speed-controls');
        const toggleIcon = document.querySelector('.toggle-icon');
        
        if (speedToggle && speedControls) {
            speedToggle.classList.toggle('open', this.isSpeedControlOpen);
            speedControls.style.display = this.isSpeedControlOpen ? 'block' : 'none';
        }
        
        // 아이콘 업데이트
        if (toggleIcon && window.iconLoader) {
            window.iconLoader.updateIcon(toggleIcon, this.isSpeedControlOpen ? 'chevron-up' : 'chevron-down');
        }
    }
    
    /**
     * 핫스팟 박스 토글
     */
    toggleHotspotBox() {
        this.isHotspotBoxOpen = !this.isHotspotBoxOpen;
        if (this.elements.hotspotBox) {
            this.elements.hotspotBox.style.display = this.isHotspotBoxOpen ? 'block' : 'none';
        }
    }
    
    /**
     * 핫스팟 박스 숨기기
     */
    hideHotspotBox() {
        this.isHotspotBoxOpen = false;
        if (this.elements.hotspotBox) {
            this.elements.hotspotBox.style.display = 'none';
        }
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
     * 타임라인 표시
     */
    showTimeline() {
        if (this.elements.timeline) {
            this.elements.timeline.style.display = 'flex';
            // body에 클래스 추가 (조작법 박스 위치 조정용)
            document.body.classList.add('has-timeline');
            // 메인 뷰어 높이 조정
            const viewer = document.querySelector('.viewer-main');
            if (viewer) {
                viewer.style.paddingBottom = 'var(--timeline-height)';
            }
        }
    }
    
    /**
     * 타임라인 숨기기
     */
    hideTimeline() {
        if (this.elements.timeline) {
            this.elements.timeline.style.display = 'none';
            // body에서 클래스 제거
            document.body.classList.remove('has-timeline');
            // 메인 뷰어 높이 복원
            const viewer = document.querySelector('.viewer-main');
            if (viewer) {
                viewer.style.paddingBottom = '0';
            }
        }
    }
    
    /**
     * 타임라인 설정
     */
    setupTimeline(duration) {
        if (!this.elements.timeline) return;
        
        this.showTimeline();
        
        // 총 시간 설정
        if (this.elements.totalTime) {
            this.elements.totalTime.textContent = this.formatTime(duration);
        }
        
        // 슬라이더 설정
        if (this.elements.timelineSlider) {
            this.elements.timelineSlider.max = duration * 100;
            this.elements.timelineSlider.value = 0;
        }
        
        // 재생 버튼 초기화
        this.updatePlayButton(false);
    }
    
    /**
     * 타임라인 업데이트
     */
    updateTimeline(currentTime, duration) {
        if (!this.elements.timeline) return;
        
        // 현재 시간 표시
        if (this.elements.currentTime) {
            this.elements.currentTime.textContent = this.formatTime(currentTime);
        }
        
        // 슬라이더 위치
        if (this.elements.timelineSlider && !this.isTimelineDragging) {
            const progress = (currentTime / duration) * 100;
            this.elements.timelineSlider.value = currentTime * 100;
            
            // 프로그레스 바
            if (this.elements.timelineProgress) {
                this.elements.timelineProgress.style.width = `${progress}%`;
            }
        }
    }
    
    /**
     * 재생 버튼 업데이트 (아이콘 시스템 사용)
     */
    updatePlayButton(isPlaying) {
        if (this.elements.playBtn) {
            const iconSpan = this.elements.playBtn.querySelector('[data-icon]');
            if (iconSpan && window.iconLoader) {
                // 아이콘 동적 변경
                window.iconLoader.updateIcon(iconSpan, isPlaying ? 'pause' : 'play', {
                    size: 24,
                    className: 'play-icon'
                });
            }
        }
    }
    
    /**
     * 시간 포맷팅
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    /**
     * 재생 버튼 클릭 핸들러
     */
    onPlayClick() {
        // app.js에서 처리하도록 이벤트 발생
        const event = new CustomEvent('timeline-play');
        window.dispatchEvent(event);
    }
    
    /**
     * 타임라인 시크 핸들러
     */
    onTimelineSeek(value) {
        const time = value / 100;
        const event = new CustomEvent('timeline-seek', { detail: { time } });
        window.dispatchEvent(event);
    }
    
    /**
     * 타임라인 드래그 상태 설정
     */
    setTimelineDragging(isDragging) {
        this.isTimelineDragging = isDragging;
    }
    
    /**
     * 모바일 메뉴 토글 (반응형)
     */
    toggleMobileMenu() {
        // 새로운 UI에서는 필요 없음
    }
    
    /**
     * UI 정리
     */
    destroy() {
        // 이벤트 리스너 제거 등 필요한 정리 작업
        console.log('🔚 UI 컨트롤러 정리');
    }
}