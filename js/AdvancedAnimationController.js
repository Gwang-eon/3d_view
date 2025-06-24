import { CONFIG } from './config.js';

export class AdvancedAnimationController {
    constructor() {
        this.mixer = null;
        this.animations = {};
        this.activeActions = {};
        this.clock = new THREE.Clock();
        
        // 고급 기능
        this.blendTime = 0.5; // 애니메이션 전환 시간
        this.timeScale = 1.0; // 재생 속도
        this.loopMode = THREE.LoopRepeat; // 루프 모드
        
        // 애니메이션 레이어
        this.layers = new Map();
        
        // 이벤트 시스템
        this.events = new Map();
        this.eventListeners = new Map();
        
        // 상태 관리
        this.state = {
            isPlaying: false,
            currentClip: null,
            previousClip: null,
            progress: 0
        };
        
        // 애니메이션 큐
        this.animationQueue = [];
        this.isQueuePlaying = false;
    }
    
    setupAnimations(animationClips, model) {
        this.cleanup();
        
        if (!animationClips || animationClips.length === 0) return;
        
        this.mixer = new THREE.AnimationMixer(model);
        
        // 믹서 이벤트 리스너
        this.mixer.addEventListener('finished', (e) => {
            this.onAnimationFinished(e);
        });
        
        // 각 클립 설정
        animationClips.forEach(clip => {
            const action = this.mixer.clipAction(clip);
            this.animations[clip.name] = {
                clip: clip,
                action: action,
                weight: 1.0,
                enabled: false,
                layer: 0
            };
            
            // 클립의 특정 시간에 이벤트 등록 가능
            this.registerClipEvents(clip);
        });
        
        console.log(`[AnimationController] ${animationClips.length}개 애니메이션 로드됨`);
    }
    
    // 애니메이션 재생 (블렌딩 지원)
    play(clipName, options = {}) {
        const {
            fadeIn = this.blendTime,
            loop = this.loopMode,
            timeScale = this.timeScale,
            weight = 1.0,
            startTime = 0
        } = options;
        
        const animation = this.animations[clipName];
        if (!animation) {
            console.warn(`애니메이션 '${clipName}'을 찾을 수 없습니다.`);
            return;
        }
        
        // 이전 애니메이션 페이드아웃
        if (this.state.currentClip && this.state.currentClip !== clipName) {
            this.fadeOut(this.state.currentClip, fadeIn);
        }
        
        // 새 애니메이션 페이드인
        const action = animation.action;
        action.reset();
        action.setLoop(loop);
        action.timeScale = timeScale;
        action.setEffectiveWeight(weight);
        action.time = startTime;
        action.fadeIn(fadeIn);
        action.play();
        
        animation.enabled = true;
        this.state.previousClip = this.state.currentClip;
        this.state.currentClip = clipName;
        this.state.isPlaying = true;
        
        this.emit('play', { clip: clipName, options });
    }
    
    // 애니메이션 페이드아웃
    fadeOut(clipName, duration = this.blendTime) {
        const animation = this.animations[clipName];
        if (!animation || !animation.enabled) return;
        
        animation.action.fadeOut(duration);
        
        // 페이드아웃 완료 후 정지
        setTimeout(() => {
            animation.action.stop();
            animation.enabled = false;
        }, duration * 1000);
    }
    
    // 여러 애니메이션 동시 재생 (레이어링)
    playMultiple(clips, options = {}) {
        clips.forEach((clipConfig, index) => {
            const { name, weight = 1.0, layer = index } = 
                typeof clipConfig === 'string' ? { name: clipConfig } : clipConfig;
            
            this.playOnLayer(name, layer, { ...options, weight });
        });
    }
    
    // 특정 레이어에서 애니메이션 재생
    playOnLayer(clipName, layer = 0, options = {}) {
        const animation = this.animations[clipName];
        if (!animation) return;
        
        animation.layer = layer;
        this.layers.set(layer, clipName);
        
        this.play(clipName, options);
    }
    
    // 애니메이션 블렌딩
    blend(fromClip, toClip, duration = this.blendTime) {
        const fromAnim = this.animations[fromClip];
        const toAnim = this.animations[toClip];
        
        if (!fromAnim || !toAnim) return;
        
        // 크로스페이드
        fromAnim.action.crossFadeTo(toAnim.action, duration, true);
        
        toAnim.enabled = true;
        fromAnim.enabled = false;
        
        this.state.currentClip = toClip;
        this.emit('blend', { from: fromClip, to: toClip, duration });
    }
    
    // 애니메이션 속도 제어
    setTimeScale(scale) {
        this.timeScale = scale;
        Object.values(this.animations).forEach(anim => {
            if (anim.enabled) {
                anim.action.timeScale = scale;
            }
        });
        this.emit('timescale', { scale });
    }
    
    // 특정 시간으로 이동
    seek(time) {
        if (!this.mixer) return;
        
        this.mixer.setTime(time);
        this.state.progress = time;
        this.emit('seek', { time });
    }
    
    // 진행률로 이동 (0-1)
    seekNormalized(progress) {
        const currentAnim = this.animations[this.state.currentClip];
        if (!currentAnim) return;
        
        const time = currentAnim.clip.duration * progress;
        this.seek(time);
    }
    
    // 애니메이션 큐 시스템
    addToQueue(clipName, options = {}) {
        this.animationQueue.push({ clipName, options });
        
        if (!this.isQueuePlaying) {
            this.playQueue();
        }
    }
    
    playQueue() {
        if (this.animationQueue.length === 0) {
            this.isQueuePlaying = false;
            this.emit('queueComplete');
            return;
        }
        
        this.isQueuePlaying = true;
        const { clipName, options } = this.animationQueue.shift();
        
        // 큐 모드에서는 루프하지 않음
        this.play(clipName, { ...options, loop: THREE.LoopOnce });
    }
    
    // 애니메이션 완료 시
    onAnimationFinished(event) {
        const clipName = event.action.getClip().name;
        this.emit('finished', { clip: clipName });
        
        // 큐 모드인 경우 다음 애니메이션 재생
        if (this.isQueuePlaying) {
            this.playQueue();
        }
    }
    
    // 키프레임 이벤트 시스템
    registerClipEvents(clip) {
        // 예: 특정 시간에 이벤트 발생
        this.events.set(clip.name, [
            // { time: 1.5, event: 'footstep' },
            // { time: 3.0, event: 'impact' }
        ]);
    }
    
    // 이벤트 리스너
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }
    
    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => callback(data));
        }
    }
    
    // 본(Bone) 레벨 제어
    setBoneWeight(boneName, weight) {
        if (!this.mixer) return;
        
        const root = this.mixer.getRoot();
        const bone = root.getObjectByName(boneName);
        
        if (bone) {
            // 특정 본의 애니메이션 가중치 조절
            Object.values(this.animations).forEach(anim => {
                if (anim.enabled) {
                    // Three.js의 PropertyMixer를 통한 본 제어
                    const binding = anim.action.getMixer()
                        ._bindingsByRootAndName[root.uuid]?.[boneName];
                    if (binding) {
                        binding.weight = weight;
                    }
                }
            });
        }
    }
    
    // 애니메이션 상태 저장/복원
    saveState() {
        const state = {
            currentClip: this.state.currentClip,
            timeScale: this.timeScale,
            animations: {}
        };
        
        Object.entries(this.animations).forEach(([name, anim]) => {
            if (anim.enabled) {
                state.animations[name] = {
                    time: anim.action.time,
                    weight: anim.action.getEffectiveWeight(),
                    enabled: true
                };
            }
        });
        
        return state;
    }
    
    restoreState(state) {
        this.timeScale = state.timeScale;
        
        Object.entries(state.animations).forEach(([name, config]) => {
            if (this.animations[name]) {
                this.play(name, {
                    startTime: config.time,
                    weight: config.weight
                });
            }
        });
    }
    
    // 애니메이션 녹화
    startRecording() {
        this.recording = {
            startTime: Date.now(),
            frames: [],
            isRecording: true
        };
    }
    
    stopRecording() {
        if (!this.recording) return;
        
        this.recording.isRecording = false;
        const recordedData = this.recording;
        this.recording = null;
        
        return recordedData;
    }
    
    // 업데이트
    update() {
        if (!this.mixer) return;
        
        const delta = this.clock.getDelta();
        this.mixer.update(delta);
        
        // 현재 애니메이션 진행 상태 업데이트
        const currentAnim = this.animations[this.state.currentClip];
        if (currentAnim && currentAnim.enabled) {
            this.state.progress = currentAnim.action.time / currentAnim.clip.duration;
            
            // 키프레임 이벤트 체크
            this.checkKeyframeEvents(currentAnim);
        }
        
        // 녹화 중이면 프레임 저장
        if (this.recording?.isRecording) {
            this.recordFrame();
        }
    }
    
    checkKeyframeEvents(animation) {
        const events = this.events.get(animation.clip.name);
        if (!events) return;
        
        const currentTime = animation.action.time;
        events.forEach(event => {
            if (Math.abs(currentTime - event.time) < 0.1 && !event.triggered) {
                event.triggered = true;
                this.emit('keyframe', { 
                    event: event.event, 
                    time: event.time,
                    clip: animation.clip.name 
                });
                
                // 리셋을 위해 타이머 설정
                setTimeout(() => { event.triggered = false; }, 100);
            }
        });
    }
    
    recordFrame() {
        const frame = {
            time: Date.now() - this.recording.startTime,
            state: this.saveState()
        };
        this.recording.frames.push(frame);
    }
    
    // 디버그 정보
    getDebugInfo() {
        return {
            currentClip: this.state.currentClip,
            isPlaying: this.state.isPlaying,
            progress: this.state.progress,
            timeScale: this.timeScale,
            activeAnimations: Object.entries(this.animations)
                .filter(([_, anim]) => anim.enabled)
                .map(([name, anim]) => ({
                    name,
                    time: anim.action.time,
                    weight: anim.action.getEffectiveWeight()
                }))
        };
    }
    
    cleanup() {
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer.uncacheRoot(this.mixer.getRoot());
            this.mixer = null;
        }
        this.animations = {};
        this.state.currentClip = null;
        this.state.isPlaying = false;
        this.layers.clear();
        this.events.clear();
        this.animationQueue = [];
    }
}