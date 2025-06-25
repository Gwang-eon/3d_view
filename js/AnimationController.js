// AnimationController.js - 애니메이션 제어 시스템

/**
 * 애니메이션 컨트롤러
 * - Three.js AnimationMixer 관리
 * - 애니메이션 재생/일시정지/정지
 * - 진행률 추적
 * - 이벤트 시스템
 * - 속도 제어
 */
export class AnimationController {
    constructor() {
        this.mixer = null;
        this.actions = {};
        this.activeAction = null;
        this.clock = new THREE.Clock();
        this.isPlaying = false;
        
        // 이벤트 시스템
        this.events = new Map();
        
        // 애니메이션 상태
        this.state = {
            currentAnimation: null,
            progress: 0,
            duration: 0,
            speed: 1.0
        };
        
        console.log('[AnimationController] 초기화 완료');
    }
    
    /**
     * 애니메이션 설정
     */
    setAnimations(animations) {
        if (!animations || animations.length === 0) {
            console.log('[AnimationController] 애니메이션이 없습니다.');
            this.emit('no-animations');
            return;
        }
        
        console.log(`[AnimationController] ${animations.length}개 애니메이션 설정`);
        
        // 이전 애니메이션 정리
        this.cleanup();
        
        // 애니메이션이 있는 첫 번째 씬 찾기
        let targetScene = null;
        if (animations[0].target) {
            targetScene = animations[0].target;
        } else {
            // 씬을 찾아야 함 - SceneManager에서 현재 모델 가져오기
            console.warn('[AnimationController] 애니메이션 타겟이 지정되지 않았습니다.');
        }
        
        // 새 믹서 생성
        this.mixer = new THREE.AnimationMixer(targetScene);
        
        // 각 애니메이션에 대한 액션 생성
        animations.forEach((clip, index) => {
            const action = this.mixer.clipAction(clip);
            const name = clip.name || `Animation_${index}`;
            this.actions[name] = action;
            
            console.log(`[AnimationController] 애니메이션 추가: ${name} (${clip.duration.toFixed(2)}초)`);
        });
        
        // 첫 번째 애니메이션을 기본으로 설정
        const firstKey = Object.keys(this.actions)[0];
        if (firstKey) {
            this.activeAction = this.actions[firstKey];
            this.state.currentAnimation = firstKey;
            this.state.duration = this.activeAction.getClip().duration;
        }
        
        this.emit('animations-loaded', {
            count: animations.length,
            animations: Object.keys(this.actions)
        });
    }
    
    /**
     * 애니메이션 재생
     */
    play(animationName = null) {
        if (!this.mixer) {
            console.warn('[AnimationController] 믹서가 설정되지 않았습니다.');
            return;
        }
        
        // 특정 애니메이션 지정
        if (animationName && this.actions[animationName]) {
            if (this.activeAction && this.activeAction !== this.actions[animationName]) {
                this.activeAction.stop();
            }
            this.activeAction = this.actions[animationName];
            this.state.currentAnimation = animationName;
            this.state.duration = this.activeAction.getClip().duration;
        }
        
        if (this.activeAction) {
            this.activeAction.play();
            this.isPlaying = true;
            console.log(`[AnimationController] 애니메이션 재생: ${this.state.currentAnimation}`);
            
            this.emit('animation:start', {
                name: this.state.currentAnimation,
                duration: this.state.duration
            });
        }
    }
    
    /**
     * 애니메이션 일시정지
     */
    pause() {
        if (this.activeAction && this.isPlaying) {
            this.activeAction.paused = true;
            this.isPlaying = false;
            console.log('[AnimationController] 애니메이션 일시정지');
            
            this.emit('animation:pause', {
                name: this.state.currentAnimation,
                progress: this.getProgress()
            });
        }
    }
    
    /**
     * 애니메이션 정지
     */
    stop() {
        if (this.activeAction) {
            this.activeAction.stop();
            this.isPlaying = false;
            this.state.progress = 0;
            console.log('[AnimationController] 애니메이션 정지');
            
            this.emit('animation:stop', {
                name: this.state.currentAnimation
            });
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
     * 재생 속도 설정
     */
    setTimeScale(scale) {
        if (this.mixer) {
            this.mixer.timeScale = scale;
            this.state.speed = scale;
            console.log(`[AnimationController] 재생 속도: ${scale}x`);
            
            this.emit('speed:change', { speed: scale });
        }
    }
    
    /**
     * 프레임 업데이트
     */
    update() {
        if (this.mixer && this.isPlaying) {
            const delta = this.clock.getDelta();
            this.mixer.update(delta);
            
            // 진행률 업데이트
            const progress = this.getProgress();
            if (Math.abs(progress - this.state.progress) > 0.1) {
                this.state.progress = progress;
                this.emit('animation:progress', progress);
            }
            
            // 애니메이션 종료 확인
            if (this.activeAction && this.activeAction.time >= this.activeAction.getClip().duration) {
                if (!this.activeAction.loop) {
                    this.emit('animation:complete', {
                        name: this.state.currentAnimation
                    });
                }
            }
        }
    }
    
    /**
     * 진행률 가져오기 (0-100)
     */
    getProgress() {
        if (this.activeAction && this.activeAction.getClip()) {
            const clip = this.activeAction.getClip();
            const currentTime = this.activeAction.time;
            const duration = clip.duration;
            return (currentTime / duration) * 100;
        }
        return 0;
    }
    
    /**
     * 진행률 설정 (0-100)
     */
    setProgress(progress) {
        if (this.activeAction && this.activeAction.getClip()) {
            const clip = this.activeAction.getClip();
            const duration = clip.duration;
            this.activeAction.time = (progress / 100) * duration;
            this.state.progress = progress;
            
            this.emit('animation:seek', {
                progress: progress,
                time: this.activeAction.time
            });
        }
    }
    
    /**
     * 특정 시간으로 이동
     */
    setTime(time) {
        if (this.activeAction) {
            this.activeAction.time = time;
            this.state.progress = this.getProgress();
            
            this.emit('animation:seek', {
                progress: this.state.progress,
                time: time
            });
        }
    }
    
    /**
     * 애니메이션 전환
     */
    switchAnimation(animationName, fadeTime = 0.5) {
        if (!this.actions[animationName]) {
            console.warn(`[AnimationController] 애니메이션을 찾을 수 없습니다: ${animationName}`);
            return;
        }
        
        const newAction = this.actions[animationName];
        
        if (this.activeAction && this.activeAction !== newAction) {
            // 페이드 전환
            if (fadeTime > 0) {
                this.activeAction.fadeOut(fadeTime);
                newAction.reset().fadeIn(fadeTime).play();
            } else {
                // 즉시 전환
                this.activeAction.stop();
                newAction.play();
            }
        } else {
            newAction.play();
        }
        
        this.activeAction = newAction;
        this.state.currentAnimation = animationName;
        this.state.duration = newAction.getClip().duration;
        this.isPlaying = true;
        
        this.emit('animation:switch', {
            name: animationName,
            duration: this.state.duration
        });
    }
    
    /**
     * 루프 설정
     */
    setLoop(loop) {
        if (this.activeAction) {
            this.activeAction.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
            this.activeAction.clampWhenFinished = !loop;
        }
    }
    
    /**
     * 애니메이션 목록 가져오기
     */
    getAnimationList() {
        return Object.keys(this.actions).map(name => ({
            name: name,
            duration: this.actions[name].getClip().duration,
            isActive: this.state.currentAnimation === name
        }));
    }
    
    /**
     * 애니메이션 여부 확인
     */
    hasAnimations() {
        return Object.keys(this.actions).length > 0;
    }
    
    /**
     * 현재 상태 가져오기
     */
    getState() {
        return {
            isPlaying: this.isPlaying,
            currentAnimation: this.state.currentAnimation,
            progress: this.getProgress(),
            duration: this.state.duration,
            speed: this.state.speed,
            hasAnimations: this.hasAnimations()
        };
    }
    
    /**
     * 정리
     */
    cleanup() {
        this.stop();
        
        // 모든 액션 정리
        Object.values(this.actions).forEach(action => {
            action.stop();
        });
        
        this.actions = {};
        this.activeAction = null;
        this.mixer = null;
        this.state = {
            currentAnimation: null,
            progress: 0,
            duration: 0,
            speed: 1.0
        };
        
        this.emit('cleanup');
    }
    
    // === 이벤트 시스템 ===
    
    /**
     * 이벤트 리스너 등록
     */
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(callback);
        return this;
    }
    
    /**
     * 이벤트 리스너 제거
     */
    off(event, callback) {
        if (this.events.has(event)) {
            this.events.get(event).delete(callback);
        }
        return this;
    }
    
    /**
     * 일회성 이벤트 리스너
     */
    once(event, callback) {
        const onceWrapper = (...args) => {
            callback(...args);
            this.off(event, onceWrapper);
        };
        this.on(event, onceWrapper);
        return this;
    }
    
    /**
     * 이벤트 발생
     */
    emit(event, ...args) {
        if (this.events.has(event)) {
            this.events.get(event).forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`[AnimationController] 이벤트 콜백 오류 (${event}):`, error);
                }
            });
        }
        return this;
    }
    
    /**
     * 디버그 정보
     */
    debug() {
        console.group('[AnimationController] 디버그 정보');
        console.log('상태:', this.state);
        console.log('재생 중:', this.isPlaying);
        console.log('애니메이션 수:', Object.keys(this.actions).length);
        console.log('애니메이션 목록:', this.getAnimationList());
        console.log('이벤트 리스너:', Array.from(this.events.keys()));
        console.groupEnd();
    }
}