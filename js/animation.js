// js/animation.js - 애니메이션 컨트롤러

// 전역 THREE 객체 확인
if (typeof THREE === 'undefined') {
    console.error('Three.js가 로드되지 않았습니다.');
}

export class AnimationController {
    constructor(viewer) {
        this.viewer = viewer;
        this.mixer = null;
        this.clips = [];
        this.actions = new Map();
        this.clock = new THREE.Clock();
        
        // 상태
        this.isPlaying = false;
        this.currentAction = null;
        
        // UI 요소
        this.controls = null;
        
        // 애니메이션 루프 ID (중복 방지용)
        this.animationLoopId = null;
    }
    
    /**
     * 애니메이션 설정
     */
    setAnimations(animations, model) {
        // 기존 믹서 정리
        this.cleanup();
        
        if (!animations || animations.length === 0) {
            console.log('애니메이션이 없습니다.');
            this.hideControls();
            return;
        }
        
        // 새 믹서 생성
        this.mixer = new THREE.AnimationMixer(model);
        this.clips = animations;
        
        // 액션 생성
        animations.forEach(clip => {
            const action = this.mixer.clipAction(clip);
            action.setLoop(THREE.LoopRepeat);
            this.actions.set(clip.name, action);
            console.log(`액션 생성: ${clip.name}`);
        });
        
        console.log(`✅ ${animations.length}개 애니메이션 로드됨`);
        
        // UI 업데이트
        this.showControls();
        this.createAnimationList();
        
        // 첫 번째 애니메이션 자동 재생
        if (animations.length > 0) {
            this.playAnimation(animations[0].name);
        }
        
        // 독립적인 업데이트 루프 시작
        this.startUpdateLoop();
    }
    
    /**
     * 애니메이션 재생
     */
    playAnimation(clipName) {
        const action = this.actions.get(clipName);
        if (!action) {
            console.error(`애니메이션을 찾을 수 없습니다: ${clipName}`);
            return;
        }
        
        console.log(`🎬 애니메이션 재생: ${clipName}`);
        
        // 이전 애니메이션 정지
        if (this.currentAction && this.currentAction !== action) {
            this.currentAction.fadeOut(0.5);
        }
        
        // 새 애니메이션 시작 - 완전한 설정
        action.reset();
        action.enabled = true;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(1);
        action.fadeIn(0.5);
        action.play();
        
        this.currentAction = action;
        this.isPlaying = true;
        
        console.log(`▶️ 재생 상태: enabled=${action.enabled}, weight=${action.getEffectiveWeight()}`);
        
        this.updatePlayButton();
    }
    
    /**
     * 재생/일시정지 토글
     */
    togglePlayPause() {
        if (!this.currentAction) {
            console.warn('재생할 애니메이션이 없습니다.');
            return;
        }
        
        if (this.isPlaying) {
            this.currentAction.paused = true;
            this.isPlaying = false;
            console.log('⏸️ 애니메이션 일시정지');
        } else {
            this.currentAction.paused = false;
            this.isPlaying = true;
            console.log('▶️ 애니메이션 재개');
        }
        
        this.updatePlayButton();
    }
    
    /**
     * 애니메이션 정지
     */
    stop() {
        if (this.currentAction) {
            this.currentAction.stop();
            this.isPlaying = false;
            this.currentAction = null;
            console.log('⏹️ 애니메이션 정지');
        }
        
        this.updatePlayButton();
    }
    
    /**
     * UI 컨트롤 표시
     */
    showControls() {
        this.controls = document.getElementById('animation-controls');
        if (!this.controls) {
            this.createControls();
        }
        
        if (this.controls) {
            this.controls.style.display = 'flex';
        }
    }
    
    /**
     * UI 컨트롤 숨기기
     */
    hideControls() {
        if (this.controls) {
            this.controls.style.display = 'none';
        }
    }
    
    /**
     * 컨트롤 생성
     */
    createControls() {
        // 컨트롤 컨테이너
        const container = document.createElement('div');
        container.id = 'animation-controls';
        container.className = 'animation-controls';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 12px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 100;
        `;
        
        // 재생/일시정지 버튼
        const playButton = document.createElement('button');
        playButton.id = 'play-pause-btn';
        playButton.className = 'anim-btn';
        playButton.innerHTML = '⏸️';
        playButton.style.cssText = `
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s;
        `;
        playButton.onclick = () => this.togglePlayPause();
        
        // 정지 버튼
        const stopButton = document.createElement('button');
        stopButton.className = 'anim-btn';
        stopButton.innerHTML = '⏹️';
        stopButton.style.cssText = playButton.style.cssText;
        stopButton.onclick = () => this.stop();
        
        // 애니메이션 선택
        const select = document.createElement('select');
        select.id = 'animation-select';
        select.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
        `;
        select.onchange = (e) => this.playAnimation(e.target.value);
        
        container.appendChild(playButton);
        container.appendChild(stopButton);
        container.appendChild(select);
        
        document.body.appendChild(container);
        this.controls = container;
    }
    
    /**
     * 애니메이션 목록 생성
     */
    createAnimationList() {
        const select = document.getElementById('animation-select');
        if (!select) return;
        
        select.innerHTML = '';
        
        this.clips.forEach((clip, index) => {
            const option = document.createElement('option');
            option.value = clip.name;
            option.textContent = clip.name || `애니메이션 ${index + 1}`;
            select.appendChild(option);
        });
    }
    
    /**
     * 재생 버튼 업데이트
     */
    updatePlayButton() {
        const button = document.getElementById('play-pause-btn');
        if (button) {
            button.innerHTML = this.isPlaying ? '⏸️' : '▶️';
        }
    }
    
    /**
     * 업데이트 루프 시작
     */
    startUpdateLoop() {
        // 기존 루프가 있다면 중지
        if (this.animationLoopId) {
            cancelAnimationFrame(this.animationLoopId);
        }
        let lastTime = performance.now();
    
        const animate = () => {
            this.animationLoopId = requestAnimationFrame(animate);
            
            if (this.mixer) {
                // 수동으로 delta 계산
                const currentTime = performance.now();
                const delta = (currentTime - lastTime) / 1000; // 밀리초를 초로 변환
                lastTime = currentTime;
                
                if (delta > 0 && delta < 0.1) { // 너무 큰 delta 방지
                    this.mixer.update(delta);
                    
                    // 디버깅용 - 첫 몇 프레임만 로그
                    if (this.mixer.time < 0.1) {
                        console.log(`Mixer 업데이트: delta=${delta.toFixed(4)}, time=${this.mixer.time.toFixed(4)}`);
                    }
                }
            }
        };
        
        animate();
        console.log('✅ 애니메이션 업데이트 루프 시작 (수동 delta)');
    }
    
    /**
     * 업데이트 루프 중지
     */
    stopUpdateLoop() {
        if (this.animationLoopId) {
            cancelAnimationFrame(this.animationLoopId);
            this.animationLoopId = null;
            console.log('⏹️ 애니메이션 업데이트 루프 중지');
        }
    }
    
    /**
     * 정리
     */
    cleanup() {
        // 업데이트 루프 중지
        this.stopUpdateLoop();
        
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer = null;
        }
        
        this.clips = [];
        this.actions.clear();
        this.currentAction = null;
        this.isPlaying = false;
        
        // Clock 정지
        this.clock.stop();
    }
    
    /**
     * 완전 제거
     */
    destroy() {
        this.cleanup();
        this.hideControls();
        
        if (this.controls && this.controls.parentNode) {
            this.controls.parentNode.removeChild(this.controls);
        }
    }
}