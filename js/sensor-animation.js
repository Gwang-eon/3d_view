// js/sensor-animation.js - 센서 체크 기반 애니메이션 컨트롤러

import { AnimationController } from './animation.js';

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
        
        // 기본 균열 감지 시점 (초 단위)
        this.defaultCrackEndTime = 3.5;
        
        // 모델별 균열 감지 시점 설정
        this.modelCrackTimes = {
            'Block_Retaining_Wall': 4.0,
            'Cantilever_Retaining_Wall': 3.5,
            'mse_Retaining_Wall': 5.0
        };
        
        // 현재 모델명
        this.currentModelName = null;
        
        // UI 생성 여부
        this.sensorUICreated = false;
        
        // 재생 종료 시점
        this.playEndTime = null;
    }
    
    /**
     * 애니메이션 설정 (오버라이드)
     */
    setAnimations(animations, model) {
        super.setAnimations(animations, model);
        
        // 애니메이션이 있을 때만 센서 UI 표시
        if (animations && animations.length > 0) {
            this.createSensorUI();
            this.updatePlayMode();
        }
    }
    
    /**
     * 모델명 설정
     */
    setModelName(modelName) {
        this.currentModelName = modelName;
    }
    
    /**
     * 균열 감지 시점 가져오기
     */
    getCrackEndTime() {
        return this.modelCrackTimes[this.currentModelName] || this.defaultCrackEndTime;
    }
    
    /**
     * 센서 활성화/비활성화
     */
    setSensorsEnabled(enabled) {
        this.sensorsEnabled = enabled;
        this.showSensors(enabled);
        this.updatePlayMode();
        
        console.log(`📍 센서 ${enabled ? '활성화' : '비활성화'}`);
    }
    
    /**
     * 재생 모드 업데이트
     */
    updatePlayMode() {
        if (this.sensorsEnabled) {
            // 센서 활성화: 균열 감지까지만 재생
            this.playEndTime = this.getCrackEndTime();
            console.log(`🎯 재생 모드: 균열 감지까지 (${this.playEndTime}초)`);
        } else {
            // 센서 비활성화: 끝까지 재생
            this.playEndTime = null;
            console.log('🎯 재생 모드: 전체 붕괴');
        }
    }
    
    /**
     * 재생 (오버라이드)
     */
    play() {
        if (!this.mixer || this.actions.size === 0) return;
        
        // 재생 종료 시점이 설정되어 있고, 현재 시간이 그 시점이면 처음부터
        if (this.playEndTime && this.currentTime >= this.playEndTime - 0.01) {
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
        
        // 기본 재생 로직
        super.play();
        
        // 재생 모드 로그
        if (this.sensorsEnabled) {
            console.log(`▶️ 재생 시작: 균열 감지 모드 (0 ~ ${this.playEndTime}초)`);
        } else {
            console.log(`▶️ 재생 시작: 전체 붕괴 모드 (0 ~ ${this.duration}초)`);
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
                    
                    if (this.sensorsEnabled && this.playEndTime && this.currentTime >= this.playEndTime) {
                        // 균열 감지 시점에서 정지
                        shouldStop = true;
                        console.log('⏸️ 균열 감지 시점 도달 - 자동 정지');
                        this.showCrackDetectionAlert();
                    } else if (!this.sensorsEnabled && this.currentTime >= this.duration - 0.01) {
                        // 전체 재생 완료
                        shouldStop = true;
                        console.log('🏁 붕괴 애니메이션 완료');
                    } else if (this.currentTime >= this.duration - 0.01) {
                        // 일반 종료
                        shouldStop = true;
                    }
                    
                    if (shouldStop) {
                        this.pause();
                        this.onAnimationComplete();
                    }
                }
            }
        };
        
        this.clock.start();
        animate();
        
        console.log('✅ 센서 기반 애니메이션 루프 시작');
    }
    
    /**
     * 센서(핫스팟 + 3D 모델) 표시/숨김
     */
    showSensors(show) {
        // 1. 핫스팟 표시/숨김
        if (this.viewer.app && this.viewer.app.hotspotManager) {
            const hotspots = this.viewer.app.hotspotManager.sprites;
            hotspots.forEach(sprite => {
                sprite.visible = show;
            });
        }
        
        // 2. 3D 센서 모델 표시/숨김
        if (this.viewer.currentModel) {
            // 센서 이름 패턴
            const sensorPatterns = [
                'sensor',           // 최상위 Sensor 그룹
                'crack_sensor',     // 균열 센서
                'tilt_sensor',      // 기울기 센서
                'tilt_sensor',      // 기울기 센서 (오타 가능성)
                'pressure_sensor'   // 압력 센서 (있을 경우)
            ];
            
            // 모델 순회하며 센서 찾기
            this.viewer.currentModel.traverse((child) => {
                if (child.name) {
                    const nameLower = child.name.toLowerCase();
                    
                    // 센서 패턴 매칭
                    const isSensor = sensorPatterns.some(pattern => 
                        nameLower.includes(pattern.toLowerCase())
                    );
                    
                    if (isSensor) {
                        child.visible = show;
                        
                        // 하위 오브젝트도 모두 표시/숨김
                        child.traverse((subChild) => {
                            subChild.visible = show;
                        });
                        
                        console.log(`${show ? '👁️' : '🙈'} 3D 센서: ${child.name}`);
                    }
                }
            });
        }
        
        console.log(show ? '👁️ 센서 표시 (핫스팟 + 3D 모델)' : '🙈 센서 숨김 (핫스팟 + 3D 모델)');
    }
    
    /**
     * 균열 감지 알림
     */
    showCrackDetectionAlert() {
        // 알림 UI 생성
        const alert = document.createElement('div');
        alert.className = 'crack-detection-alert';
        alert.innerHTML = `
            <div class="alert-icon">⚠️</div>
            <div class="alert-content">
                <h4>균열 감지!</h4>
                <p>센서가 위험 수준의 균열을 감지했습니다.</p>
            </div>
        `;
        
        document.body.appendChild(alert);
        
        // 3초 후 자동 제거
        setTimeout(() => {
            alert.classList.add('fade-out');
            setTimeout(() => alert.remove(), 300);
        }, 3000);
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
                        센서 표시
                    </span>
                </label>
                <div class="sensor-info">
                    <span class="info-text" id="sensor-info-text">균열 감지 모드</span>
                </div>
            </div>
        `;
        
        // 타임라인 앞에 추가
        timelineContainer.insertAdjacentHTML('afterbegin', sensorHTML);
        
        // 이벤트 리스너 추가
        const sensorToggle = document.getElementById('sensor-toggle');
        sensorToggle.addEventListener('change', (e) => {
            this.setSensorsEnabled(e.target.checked);
            this.updateSensorInfo(e.target.checked);
        });
        
        this.sensorUICreated = true;
        
        // CSS 추가
        this.addSensorStyles();
    }
    
    /**
     * 센서 정보 업데이트
     */
    updateSensorInfo(enabled) {
        const infoText = document.getElementById('sensor-info-text');
        if (infoText) {
            if (enabled) {
                infoText.textContent = `균열 감지 모드 (${this.getCrackEndTime()}초)`;
                infoText.style.color = '#00ff88';
            } else {
                infoText.textContent = '전체 붕괴 모드';
                infoText.style.color = '#ff6b35';
            }
        }
    }
    
    /**
     * 센서 스타일 추가
     */
    addSensorStyles() {
        if (document.getElementById('sensor-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'sensor-styles';
        style.textContent = `
            .sensor-control {
                display: flex;
                align-items: center;
                gap: 20px;
                padding: 8px 16px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                margin-right: 16px;
            }
            
            .sensor-checkbox {
                display: flex;
                align-items: center;
                cursor: pointer;
                user-select: none;
            }
            
            .sensor-checkbox input {
                display: none;
            }
            
            .checkbox-custom {
                width: 44px;
                height: 24px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 12px;
                position: relative;
                transition: background 0.3s ease;
                margin-right: 12px;
            }
            
            .checkbox-custom::after {
                content: '';
                position: absolute;
                width: 20px;
                height: 20px;
                background: white;
                border-radius: 50%;
                top: 2px;
                left: 2px;
                transition: transform 0.3s ease;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .sensor-checkbox input:checked + .checkbox-custom {
                background: var(--accent);
            }
            
            .sensor-checkbox input:checked + .checkbox-custom::after {
                transform: translateX(20px);
            }
            
            .checkbox-label {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 14px;
                color: var(--text-primary);
            }
            
            .sensor-icon {
                font-size: 18px;
            }
            
            .sensor-info {
                padding: 4px 12px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 20px;
                font-size: 13px;
            }
            
            .info-text {
                font-weight: 500;
                transition: color 0.3s ease;
            }
            
            /* 균열 감지 알림 */
            .crack-detection-alert {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(255, 107, 53, 0.95);
                color: white;
                padding: 24px 32px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                z-index: 2000;
                animation: alertPulse 0.5s ease;
                display: flex;
                align-items: center;
                gap: 16px;
            }
            
            .crack-detection-alert.fade-out {
                animation: alertFadeOut 0.3s ease;
                opacity: 0;
            }
            
            .alert-icon {
                font-size: 48px;
                animation: alertIconPulse 1s ease infinite;
            }
            
            .alert-content h4 {
                margin: 0 0 4px 0;
                font-size: 20px;
            }
            
            .alert-content p {
                margin: 0;
                font-size: 14px;
                opacity: 0.9;
            }
            
            @keyframes alertPulse {
                0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
                50% { transform: translate(-50%, -50%) scale(1.05); }
                100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }
            
            @keyframes alertFadeOut {
                to { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
            }
            
            @keyframes alertIconPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
            
            /* 모바일 대응 */
            @media (max-width: 768px) {
                .sensor-control {
                    position: absolute;
                    bottom: 70px;
                    left: 10px;
                    right: auto;
                    flex-direction: column;
                    gap: 8px;
                    padding: 12px;
                }
                
                .sensor-info {
                    width: 100%;
                    text-align: center;
                }
            }
            
            /* 타임라인 컨테이너 수정 */
            #animation-timeline {
                justify-content: flex-start;
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * 애니메이션 완료 처리 (오버라이드)
     */
    onAnimationComplete() {
        console.log('🏁 애니메이션 구간 완료');
        
        this.isPlaying = false;
        this.updatePlayButton();
        
        // 콜백 실행
        if (this.onAnimationEnd) {
            this.onAnimationEnd();
        }
    }
    
    /**
     * 정리 (오버라이드)
     */
    destroy() {
        // 센서 UI 제거
        const sensorUI = document.querySelector('.sensor-control');
        if (sensorUI) {
            sensorUI.remove();
        }
        
        // 스타일 제거
        const sensorStyles = document.getElementById('sensor-styles');
        if (sensorStyles) {
            sensorStyles.remove();
        }
        
        // 알림 제거
        const alerts = document.querySelectorAll('.crack-detection-alert');
        alerts.forEach(alert => alert.remove());
        
        this.sensorUICreated = false;
        
        super.destroy();
    }
}