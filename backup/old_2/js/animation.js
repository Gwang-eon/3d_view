// js/animation.js - 애니메이션 컨트롤러 (최소 수정 버전 - 시킹 로직만 개선)

export class AnimationController {
    constructor(viewer) {
        this.viewer = viewer;
        this.mixer = null;
        this.clips = [];
        this.actions = new Map();
        this.currentAction = null;
        
        // 상태
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.isSeeking = false; // ✅ 시킹 상태 추적
        
        // Three.js Clock
        this.clock = new THREE.Clock();
        
        // 애니메이션 루프 ID
        this.animationLoopId = null;
        
        // 콜백
        this.onAnimationEnd = null;
    }
    
    /**
     * 애니메이션 설정
     */
    setAnimations(clips, model) {
        this.cleanup();
        
        if (!clips || clips.length === 0) {
            console.log('ℹ️ 설정할 애니메이션이 없습니다');
            return;
        }
        
        // 믹서 생성
        this.mixer = new THREE.AnimationMixer(model);
        this.clips = clips;
        
        // 액션 생성
        clips.forEach((clip, index) => {
            const action = this.mixer.clipAction(clip);
            this.actions.set(clip.name, action);
            
            console.log(`🎬 액션 생성: ${clip.name} (${clip.duration.toFixed(2)}초)`);
        });
        
        // 첫 번째 애니메이션 선택
        if (clips.length > 0) {
            this.selectAnimation(clips[0].name);
        }
        
        // 업데이트 루프 시작
        this.startUpdateLoop();
        
        console.log(`✅ 애니메이션 설정 완료: ${clips.length}개`);
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
     * ✅ 특정 시간으로 이동 (개선된 시킹 로직)
     */
    seek(time) {
        if (!this.mixer || this.actions.size === 0) return;
        
        // ✅ 시킹 상태 설정
        this.isSeeking = true;
        this.currentTime = Math.max(0, Math.min(time, this.duration));
        
        // ✅ 믹서 시간 설정
        this.mixer.setTime(this.currentTime);
        
        // ✅ 강제 업데이트 (0 delta로 한 번만)
        this.mixer.update(0);
        
        // ✅ 타임라인 업데이트 (한 번만)
        this.updateTimeline();
        
        // ✅ 100ms 후 시킹 상태 해제 (한 번만)
        setTimeout(() => {
            this.isSeeking = false;
        }, 100);
        
        console.log(`⏭️ 시킹: ${this.currentTime.toFixed(2)}초`);
    }
    
    /**
     * 백분율로 시킹
     */
    seekToPercentage(percentage) {
        const time = (percentage / 100) * this.duration;
        this.seek(time);
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