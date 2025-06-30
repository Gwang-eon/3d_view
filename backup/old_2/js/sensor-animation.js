// js/sensor-animation.js - 센서 체크 기반 애니메이션 컨트롤러 (순환 참조 수정)

import { AnimationController } from './animation.js';
// ❌ 제거: import { SensorChartManager } from './sensor-chart.js';

export class SensorAnimationController extends AnimationController {
    constructor(viewer) {
        super(viewer);
        
        // 센서 표시 상태
        this.sensorsEnabled = true;
        
        // 재생 모드
        this.PLAY_MODES = {
            CRACK_DETECTION: 'crack_detection',  // 균열 감지까지
            FULL_COLLAPSE: 'full_collapse'       // 붕괴까지
        };
        
        // 기본 FPS 설정
        this.fps = 30;  // 모든 모델 30fps 기준

        // ✅ app.js를 통해 chartManager 접근하도록 변경
        // this.chartManager는 필요할 때 this.viewer.app.chartManager로 접근
        
        // 모델별 프레임 설정 (완전한 설정)
        this.modelFrameSettings = {
            'Block_Retaining_Wall': {
                startFrame: 1,      // 시작 프레임
                crackFrame: 30,     // 균열 감지 프레임
                endFrame: null,     // 마지막 프레임 (자동 감지)
                fps: 30
            },
            'Cantilever_Retaining_Wall': {
                startFrame: 10,     // 특수: 10프레임부터 시작!
                crackFrame: 30,     // 균열 감지 프레임
                endFrame: 320,      // 마지막 프레임
                fps: 30
            },
            'mse_Retaining_Wall': {
                startFrame: 1,      // 시작 프레임
                crackFrame: 20,     // 균열 감지 프레임
                endFrame: null,     // 마지막 프레임 (자동 감지)
                fps: 30
            }
        };
        
        // 현재 모델명
        this.currentModelName = null;
        
        // UI 생성 여부
        this.sensorUICreated = false;
        
        // 재생 종료 시점
        this.playEndTime = null;
        this.playEndFrame = null;
        
        // 시작 시점
        this.playStartTime = 0;
        this.playStartFrame = 1;
        
        // 사용자 정의 균열 감지 프레임
        this.customCrackFrame = null;
    }
    
    /**
     * ChartManager 접근 (안전한 방법)
     */
    get chartManager() {
        return this.viewer.app?.chartManager || null;
    }
    
    /**
     * 애니메이션 설정 (오버라이드)
     */
    setAnimations(animations, model) {
        super.setAnimations(animations, model);
        
        // 애니메이션이 있을 때만 센서 UI 표시
        if (animations && animations.length > 0) {
            this.createSensorUI();
            this.updateModelSettings();
            this.updatePlayMode();
            this.setInitialFrame();  // 초기 프레임 설정 추가
        }
    }
    
    /**
     * 초기 프레임으로 이동
     */
    setInitialFrame() {
        if (!this.mixer || !this.currentModelName) return;
        
        const settings = this.getCurrentSettings();
        const startTime = this.frameToTime(settings.startFrame);
        
        // 시작 프레임으로 이동
        this.currentTime = startTime;
        this.mixer.setTime(startTime);
        
        // 모든 액션 초기화
        this.actions.forEach(action => {
            action.reset();
            action.enabled = true;
            action.setEffectiveTimeScale(1);
            action.setEffectiveWeight(1);
            action.play();
            action.time = startTime;
            action.paused = true;
        });
        
        this.mixer.update(0);
        this.updateTimeline();
        
        console.log(`📍 초기 프레임 설정: ${settings.startFrame}프레임 (${startTime.toFixed(2)}초)`);
    }
    
    /**
     * 모델 설정 업데이트
     */
    updateModelSettings() {
        // 모델명 감지
        if (this.viewer.currentModel) {
            // 여러 방법으로 모델명 추출 시도
            this.currentModelName = 
                this.viewer.currentModel.userData?.modelName ||
                this.viewer.currentModel.name ||
                this.detectModelFromScene() ||
                'Block_Retaining_Wall'; // 기본값
        }
        
        console.log(`🏗️ 모델명 설정: ${this.currentModelName}`);
        
        // 프레임 설정 정보 출력
        const settings = this.getCurrentSettings();
        console.log('📋 프레임 설정:', settings);
    }
    
    /**
     * 장면에서 모델명 감지
     */
    detectModelFromScene() {
        if (!this.viewer.currentModel) return null;
        
        const modelIndicators = [
            { pattern: /block/i, name: 'Block_Retaining_Wall' },
            { pattern: /cantilever/i, name: 'Cantilever_Retaining_Wall' },
            { pattern: /mse/i, name: 'mse_Retaining_Wall' }
        ];
        
        let detectedModel = null;
        
        this.viewer.currentModel.traverse((child) => {
            if (child.name && !detectedModel) {
                for (const indicator of modelIndicators) {
                    if (indicator.pattern.test(child.name)) {
                        detectedModel = indicator.name;
                        break;
                    }
                }
            }
        });
        
        return detectedModel;
    }
    
    /**
     * 현재 모델 설정 가져오기
     */
    getCurrentSettings() {
        const settings = this.modelFrameSettings[this.currentModelName];
        if (!settings) {
            console.warn(`모델 설정을 찾을 수 없습니다: ${this.currentModelName}`);
            return this.modelFrameSettings['Block_Retaining_Wall']; // 기본값
        }
        
        // endFrame이 null이면 duration에서 계산
        if (settings.endFrame === null && this.duration > 0) {
            settings.endFrame = this.timeToFrame(this.duration);
        }
        
        return settings;
    }
    
    /**
     * 재생 모드 업데이트
     */
    updatePlayMode() {
        const settings = this.getCurrentSettings();
        
        if (this.sensorsEnabled) {
            // 균열 감지 모드
            this.playEndFrame = this.customCrackFrame || settings.crackFrame;
            this.playEndTime = this.frameToTime(this.playEndFrame);
            console.log(`🎯 균열 감지 모드: ${this.playEndFrame}프레임까지 재생`);
        } else {
            // 전체 붕괴 모드
            this.playEndFrame = settings.endFrame || this.timeToFrame(this.duration);
            this.playEndTime = this.frameToTime(this.playEndFrame);
            console.log(`💥 전체 붕괴 모드: ${this.playEndFrame}프레임까지 재생`);
        }
        
        // 시작 지점 설정
        this.playStartFrame = settings.startFrame || 1;
        this.playStartTime = this.frameToTime(this.playStartFrame);
    }
    
    /**
     * 시간을 프레임으로 변환
     */
    timeToFrame(time) {
        return Math.round(time * this.fps);
    }
    
    /**
     * 프레임을 시간으로 변환
     */
    frameToTime(frame) {
        return frame / this.fps;
    }
    
    /**
     * 현재 균열 감지 프레임 가져오기
     */
    getCurrentCrackFrame() {
        const settings = this.getCurrentSettings();
        return this.customCrackFrame || settings.crackFrame;
    }
    
    /**
     * 재생 (오버라이드)
     */
    play() {
        if (!this.mixer || this.actions.size === 0) {
            console.error('믹서나 액션이 없습니다');
            return;
        }
        
        // 현재 재생 종료 시점 확인
        const currentFrame = this.timeToFrame(this.currentTime);
        
        // 재생 종료 시점에 도달했거나 끝났으면 처음부터 재생
        if (this.playEndTime && this.currentTime >= this.playEndTime - 0.01) {
            console.log('🔄 재생 종료 지점 도달, 처음부터 재생');
            
            // 시작 프레임으로 리셋
            this.currentTime = this.playStartTime;
            this.mixer.setTime(this.playStartTime);
            
            // 모든 액션 리셋 및 시작 프레임으로 설정
            this.actions.forEach(action => {
                action.reset();
                action.enabled = true;
                action.setEffectiveTimeScale(1);
                action.setEffectiveWeight(1);
                action.play();
                action.time = this.playStartTime;
            });
            
            // 타임라인 업데이트
            this.updateTimeline();
            
            // 다음 프레임에서 실제 재생 시작
            setTimeout(() => {
                this.playFromStart();
            }, 50);
            
            return;
        }
        
        // 일반 재생
        this.playFromStart();
    }
    
    /**
     * 실제 재생 시작
     */
    playFromStart() {
        // 기본 재생 로직
        super.play();
        
        // 재생 정보 로그
        const currentFrame = this.timeToFrame(this.currentTime);
        const endFrame = this.playEndFrame || this.timeToFrame(this.duration);
        
        if (this.sensorsEnabled) {
            console.log(`▶️ 재생: ${currentFrame} → ${endFrame}프레임 (균열 감지 모드)`);
        } else {
            console.log(`▶️ 재생: ${currentFrame} → ${endFrame}프레임 (전체 붕괴 모드)`);
        }
    }
    
    /**
     * 업데이트 루프 수정 (오버라이드)
     */
    startUpdateLoop() {
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
                    
                    // 재생 종료 체크
                    let shouldStop = false;
                    const currentFrame = this.timeToFrame(this.currentTime);
                    
                    if (this.sensorsEnabled && this.playEndTime && this.currentTime >= this.playEndTime) {
                        console.log(`🚨 균열 감지! (${currentFrame}프레임)`);
                        shouldStop = true;
                        this.showCrackDetectionAlert();
                    } else if (!this.sensorsEnabled && this.currentTime >= this.duration - 0.01) {
                        console.log(`💥 전체 붕괴 완료! (${currentFrame}프레임)`);
                        shouldStop = true;
                    }
                    
                    if (shouldStop) {
                        this.pause();
                        this.onAnimationComplete();
                    }
                }
            }
        };
        
        animate();
    }
    
    /**
     * 센서 표시/숨기기
     */
    toggleSensors(show) {
        if (!this.viewer.currentModel) {
            console.warn('모델이 로드되지 않았습니다.');
            return;
        }
        
        let sensorCount = 0;
        let sensorNames = [];
        
        // 한 번만 디버그 정보 출력
        if (!this._debugged) {
            console.log('=== 센서 오브젝트 검색 ===');
            const allObjects = [];
            this.viewer.currentModel.traverse((child) => {
                if (child.name) {
                    allObjects.push({
                        name: child.name,
                        type: child.type,
                        visible: child.visible,
                        parent: child.parent ? child.parent.name : 'root'
                    });
                }
            });
            console.table(allObjects);
            this._debugged = true;
        }
        
        // 모델 순회하며 센서 관련 오브젝트 찾기
        this.viewer.currentModel.traverse((child) => {
            if (child.name) {
                // 원본 이름 사용 (대소문자 구분)
                const originalName = child.name;
                const lowerName = originalName.toLowerCase();
                
                // 센서 관련 이름 패턴 매칭 (대소문자 무시)
                const isSensor = (
                    // crack_sensor로 시작하는 경우
                    lowerName.startsWith('crack_sensor') ||
                    // tilt_sensor로 시작하는 경우
                    lowerName.startsWith('tilt_sensor') ||
                    // sensor.001, sensor.002 등
                    /^sensor\.\d+$/.test(lowerName) ||
                    // 정확히 sensor인 경우
                    lowerName === 'sensor' ||
                    // base 또는 base.001 등
                    lowerName === 'base' ||
                    /^base\.\d+$/.test(lowerName) ||
                    // _sensor로 끝나는 경우
                    lowerName.endsWith('_sensor') ||
                    // 추가: sensor가 포함되고 hotspot이 포함되지 않은 경우
                    (lowerName.includes('sensor') && !lowerName.includes('hotspot'))
                );
                
                if (isSensor) {
                    child.visible = show;
                    sensorCount++;
                    sensorNames.push(originalName);
                    
                    // 하위 오브젝트도 모두 표시/숨김
                    child.traverse((subChild) => {
                        if (subChild !== child) {  // 자기 자신 제외
                            subChild.visible = show;
                        }
                    });
                }
            }
        });
        
        if (sensorCount > 0) {
            console.log(`${show ? '👁️' : '🙈'} ${sensorCount}개 센서 ${show ? '표시' : '숨김'}`);
            console.log('센서 목록:', sensorNames.join(', '));
        } else {
            console.warn('⚠️ 센서 오브젝트를 찾을 수 없습니다.');
            console.log('Tip: 센서 이름이 crack_sensor.001, tilt_sensor.001, base, sensor.001 형식인지 확인하세요.');
        }
        
        console.log(show ? '👁️ 센서 표시 완료' : '🙈 센서 숨김 완료');
    }
    
    /**
     * 균열 감지 알림
     */
    showCrackDetectionAlert() {
        // 알림 UI 생성
        const alert = document.createElement('div');
        alert.className = 'crack-detection-alert';
        const frame = this.getCurrentCrackFrame();
        
        alert.innerHTML = `
            <div class="alert-icon">⚠️</div>
            <div class="alert-content">
                <h4>균열 감지!</h4>
                <p>센서가 위험 수준의 균열을 감지했습니다.</p>
                <p style="font-size: 12px; opacity: 0.8;">
                    감지 프레임: ${frame}프레임 (${this.playEndTime?.toFixed(2)}초)
                </p>
                <p style="font-size: 11px; opacity: 0.6; margin-top: 4px;">
                    재생 버튼을 다시 누르면 처음부터 재생됩니다.
                </p>
            </div>
        `;
        
        document.body.appendChild(alert);
        
        // ✅ 안전한 chartManager 접근
        console.log('📊 센서 차트 표시 시도...');
        const chartManager = this.chartManager; // getter 사용
        
        if (chartManager) {
            try {
                chartManager.show();
                const maxFrame = this.timeToFrame(this.duration);
                chartManager.startSimulation(frame, maxFrame, this.currentModelName);
                console.log('✅ 센서 차트 표시 완료');
            } catch (error) {
                console.error('❌ 센서 차트 표시 오류:', error);
            }
        } else {
            console.error('❌ chartManager를 찾을 수 없습니다');
        }

        // 4초 후 자동 제거
        setTimeout(() => {
            alert.classList.add('fade-out');
            setTimeout(() => alert.remove(), 300);
        }, 4000);
    }
    
    /**
     * 센서 UI 생성
     */
    createSensorUI() {
        if (this.sensorUICreated) return;
        
        // 기존 UI가 있으면 제거
        const existingUI = document.querySelector('.sensor-control');
        if (existingUI) {
            existingUI.remove();
        }
        
        // 타임라인 컨테이너 찾기
        const timelineContainer = document.getElementById('animation-timeline');
        if (!timelineContainer) return;
        
        // 센서 컨트롤 UI HTML
        const sensorHTML = `
            <div class="sensor-control">
                <label class="sensor-checkbox">
                    <input type="checkbox" id="sensor-toggle" checked>
                    <span class="checkbox-custom"></span>
                    <span class="checkbox-label">
                        <span class="sensor-icon">📡</span>
                        센서 설치 모드
                    </span>
                </label>
            </div>
        `;
        
        // 타임라인 앞에 삽입
        timelineContainer.insertAdjacentHTML('beforebegin', sensorHTML);
        
        // 이벤트 리스너 설정
        const sensorToggle = document.getElementById('sensor-toggle');
        if (sensorToggle) {
            sensorToggle.addEventListener('change', (e) => {
                this.sensorsEnabled = e.target.checked;
                this.toggleSensors(this.sensorsEnabled);
                this.updatePlayMode();
                
                console.log(`📡 센서 모드: ${this.sensorsEnabled ? 'ON (균열 감지)' : 'OFF (전체 붕괴)'}`);
            });
            
            // 초기 센서 표시
            this.toggleSensors(this.sensorsEnabled);
        }
        
        // 스타일 적용
        this.applySensorStyles();
        
        this.sensorUICreated = true;
        console.log('✅ 센서 UI 생성 완료');
    }
    
    /**
     * 센서 UI 스타일 적용
     */
    applySensorStyles() {
        // 기존 스타일 제거
        const existingStyle = document.getElementById('sensor-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        const style = document.createElement('style');
        style.id = 'sensor-styles';
        style.textContent = `
            .sensor-control {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 8px 16px;
                margin-bottom: 8px;
                background: rgba(20, 20, 20, 0.95);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                backdrop-filter: blur(10px);
            }
            
            .sensor-checkbox {
                display: flex;
                align-items: center;
                cursor: pointer;
                font-size: 14px;
                color: #ffffff;
                user-select: none;
            }
            
            .sensor-checkbox input[type="checkbox"] {
                display: none;
            }
            
            .checkbox-custom {
                width: 18px;
                height: 18px;
                border: 2px solid #00ff88;
                border-radius: 4px;
                margin-right: 8px;
                position: relative;
                transition: all 0.2s ease;
            }
            
            .sensor-checkbox input[type="checkbox"]:checked + .checkbox-custom {
                background: #00ff88;
                border-color: #00ff88;
            }
            
            .sensor-checkbox input[type="checkbox"]:checked + .checkbox-custom::after {
                content: '✓';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: black;
                font-size: 12px;
                font-weight: bold;
            }
            
            .checkbox-label {
                display: flex;
                align-items: center;
            }
            
            .sensor-icon {
                margin-right: 6px;
                font-size: 16px;
            }
            
            /* 균열 감지 알림 스타일 */
            .crack-detection-alert {
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #ff6b35, #ff8c42);
                color: white;
                padding: 16px 20px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(255, 107, 53, 0.4);
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 2000;
                min-width: 300px;
                animation: slideIn 0.3s ease-out;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .crack-detection-alert.fade-out {
                animation: fadeOut 0.3s ease-out forwards;
            }
            
            .alert-icon {
                font-size: 24px;
                animation: pulse 1s infinite;
            }
            
            .alert-content h4 {
                margin: 0 0 4px 0;
                font-size: 16px;
                font-weight: bold;
            }
            
            .alert-content p {
                margin: 0;
                font-size: 14px;
                line-height: 1.4;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes fadeOut {
                to {
                    opacity: 0;
                    transform: translateX(20px);
                }
            }
            
            @keyframes pulse {
                0%, 100% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.1);
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * 정리
     */
    destroy() {
        // UI 제거
        const sensorControl = document.querySelector('.sensor-control');
        if (sensorControl) {
            sensorControl.remove();
        }
        
        // 스타일 제거
        const style = document.getElementById('sensor-styles');
        if (style) {
            style.remove();
        }
        
        // 상위 클래스 정리
        super.destroy();
        
        console.log('🔚 SensorAnimationController 정리 완료');
    }
}