// js/animation.js - 수정된 애니메이션 컨트롤러 (1회 재생 및 타임라인 제어)

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
        this.duration = 0;
        this.currentTime = 0;
        
        // UI 콜백
        this.onTimeUpdate = null;
        this.onAnimationEnd = null;
        
        // 애니메이션 루프 ID
        this.animationLoopId = null;
        
        // 타임라인 드래그 상태
        this.isSeeking = false;
    }
    
    /**
     * 애니메이션 설정
     */
    setAnimations(animations, model) {
        // 기존 믹서 정리
        this.cleanup();
        
        if (!animations || animations.length === 0) {
            console.log('애니메이션이 없습니다.');
            this.hideTimeline();
            return;
        }
        
        // 새 믹서 생성
        this.mixer = new THREE.AnimationMixer(model);
        this.clips = animations;
        
        // 액션 생성
        animations.forEach(clip => {
            const action = this.mixer.clipAction(clip);
            action.setLoop(THREE.LoopOnce); // 1회만 재생
            action.clampWhenFinished = true; // 마지막 프레임 유지
            this.actions.set(clip.name, action);
            console.log(`액션 생성: ${clip.name} (${clip.duration.toFixed(2)}초)`);
        });
        
        console.log(`✅ ${animations.length}개 애니메이션 로드됨`);
        
        // 모든 애니메이션 동시 재생 준비
        if (animations.length > 0) {
            this.prepareAllAnimations();
        }
        
        // 타임라인 표시
        this.showTimeline();
        
        // 업데이트 루프 시작
        this.startUpdateLoop();
    }
    
    /**
     * 모든 애니메이션 준비
     */
    prepareAllAnimations() {
        console.log('🎬 모든 애니메이션 준비');
        
        // 가장 긴 애니메이션의 duration 찾기
        this.duration = Math.max(...this.clips.map(clip => clip.duration));
        this.currentTime = 0;
        
        // 모든 액션 초기화 및 준비
        this.actions.forEach((action, name) => {
            action.reset();
            action.enabled = true;
            action.setEffectiveTimeScale(1);
            action.setEffectiveWeight(1);
            action.play();
            action.paused = true; // 일단 일시정지 상태로
            action.time = 0;
            action.paused = true;
        });
        
        this.mixer.update(0);

        console.log(`✅ ${this.actions.size}개 애니메이션 준비 완료 (최대 길이: ${this.duration.toFixed(2)}초)`);
        
        // 타임라인 설정
        if (this.viewer.app && this.viewer.app.ui) {
            this.viewer.app.ui.setupTimeline(this.duration);
        }
        
    }
    
    /**
     * 애니메이션 선택
     */
    selectAnimation(clipName) {
        const action = this.actions.get(clipName);
        const clip = this.clips.find(c => c.name === clipName);
        
        if (!action || !clip) {
            console.error(`애니메이션을 찾을 수 없습니다: ${clipName}`);
            return;
        }
        
        // 이전 애니메이션 정지
        if (this.currentAction && this.currentAction !== action) {
            this.currentAction.stop();
        }
        
        this.currentAction = action;
        this.duration = clip.duration;
        this.currentTime = 0;
        
        // 액션 초기화 - 중요: play()를 먼저 호출해야 함
        action.reset();
        action.enabled = true;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(1);
        action.play();
        action.paused = true; // 바로 일시정지
        
        console.log(`🎬 애니메이션 선택: ${clipName} (${this.duration.toFixed(2)}초)`);
        
        // 타임라인 설정
        if (this.viewer.app && this.viewer.app.ui) {
            this.viewer.app.ui.setupTimeline(this.duration);
        }
    }
    
    /**
     * 재생/일시정지 토글
     */
    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    /**
     * 재생 (전체 애니메이션)
     */
    play() {
        if (!this.mixer || this.actions.size === 0) {
            console.error('믹서나 액션이 없습니다');
            return;
        }
        
        // 애니메이션이 끝났으면 처음부터
        if (this.currentTime >= this.duration - 0.01) {
            this.currentTime = 0;
            this.mixer.setTime(0);
            
            // 모든 액션 리셋
            this.actions.forEach(action => {
                action.reset();
                action.enabled = true;
                action.setEffectiveTimeScale(1);
                action.setEffectiveWeight(1);
            });
        }
        
        // 모든 액션 재생
        this.actions.forEach(action => {
            if (!action.isRunning()) {
                action.play();
            }
            action.paused = false;
        });
        
        this.isPlaying = true;
        
        // Clock 재시작
        this.clock.start();
        
        console.log('▶️ 모든 애니메이션 재생');
        this.updatePlayButton();
    }
    
    /**
     * 일시정지 (전체 애니메이션)
     */
    pause() {
        if (!this.mixer) return;
        
        // 모든 액션 일시정지
        this.actions.forEach(action => {
            action.paused = true;
        });
        
        this.isPlaying = false;
        
        console.log('⏸️ 모든 애니메이션 일시정지');
        this.updatePlayButton();
    }
    
    /**
     * 정지 (전체 애니메이션 처음으로)
     */
    stop() {
        if (!this.mixer) return;
        
        // 모든 액션 정지
        this.mixer.stopAllAction();
        
        // 모든 액션 리셋
        this.actions.forEach(action => {
            action.reset();
        });
        
        this.mixer.setTime(0);
        this.currentTime = 0;
        this.isPlaying = false;
        
        console.log('⏹️ 모든 애니메이션 정지');
        this.updatePlayButton();
        this.updateTimeline();
    }
    
    /**
     * 특정 시간으로 이동 (전체 애니메이션)
     */
    seek(time) {
        if (!this.mixer || this.actions.size === 0) return;
        
        this.isSeeking = true;
        this.currentTime = Math.max(0, Math.min(time, this.duration));
        // this.mixer.setTime(this.currentTime);

        // 해결: 각 액션을 명시적으로 업데이트
    this.actions.forEach(action => {
        // 액션이 실행 중이 아니면 먼저 play
        if (!action.isRunning()) {
            action.play();
        }
        // 시간 설정
        action.time = this.currentTime;
        // 강제 업데이트
        action.paused = true;
    });

        // 믹서 강제 업데이트
    this.mixer.update(0);
    
    this.updateTimeline();
    
    setTimeout(() => {
        this.isSeeking = false;
    }, 100);
        
        // 시킹 중에는 모든 액션 일시정지
        if (this.isPlaying) {
            this.actions.forEach(action => {
                action.paused = true;
            });
        }
        
        this.updateTimeline();
        
        // 시킹 완료 후 재생 중이었다면 계속 재생
        setTimeout(() => {
            this.isSeeking = false;
            if (this.isPlaying) {
                this.actions.forEach(action => {
                    action.paused = false;
                });
            }
        }, 100);
    }
    
    /**
     * 타임라인 표시
     */
    showTimeline() {
        if (this.viewer.app && this.viewer.app.ui) {
            this.viewer.app.ui.showTimeline();
        }
    }
    
    /**
     * 타임라인 숨기기
     */
    hideTimeline() {
        if (this.viewer.app && this.viewer.app.ui) {
            this.viewer.app.ui.hideTimeline();
        }
    }
    
    /**
     * 재생 버튼 업데이트
     */
    updatePlayButton() {
        if (this.viewer.app && this.viewer.app.ui) {
            this.viewer.app.ui.updatePlayButton(this.isPlaying);
        }
    }
    
    /**
     * 타임라인 업데이트
     */
    updateTimeline() {
        if (this.viewer.app && this.viewer.app.ui) {
            this.viewer.app.ui.updateTimeline(this.currentTime, this.duration);
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
        
        const animate = () => {
            this.animationLoopId = requestAnimationFrame(animate);
            
            if (this.mixer && !this.isSeeking) {
                const delta = this.clock.getDelta();
                
                if (this.isPlaying && delta > 0) {
                    this.mixer.update(delta);
                    this.currentTime = Math.min(this.currentTime + delta, this.duration);
                    
                    // 타임라인 업데이트
                    this.updateTimeline();
                    
                    // 애니메이션 종료 체크
                    if (this.currentTime >= this.duration - 0.01) {
                        this.onAnimationComplete();
                    }
                }
            }
        };
        
        this.clock.start();
        animate();
        
        console.log('✅ 애니메이션 업데이트 루프 시작');
    }
    
    /**
     * 애니메이션 완료 처리
     */
    onAnimationComplete() {
        console.log('🏁 애니메이션 완료');
        
        this.isPlaying = false;
        this.updatePlayButton();
        
        // 콜백 실행
        if (this.onAnimationEnd) {
            this.onAnimationEnd();
        }
        
        // 1초 후 자동으로 처음으로
        setTimeout(() => {
            if (!this.isPlaying) {
                this.stop();
            }
        }, 1000);
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
        this.stopUpdateLoop();
        
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer = null;
        }
        
        this.clips = [];
        this.actions.clear();
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        
        this.clock.stop();
    }
    
    /**
     * 완전 제거
     */
    destroy() {
        this.cleanup();
        this.hideTimeline();
    }
}