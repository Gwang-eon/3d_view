// CameraTransitionManager.js - 부드러운 카메라 전환을 위한 모듈
export class CameraTransitionManager {
    constructor(camera, controls) {
        this.camera = camera;
        this.controls = controls;
        this.isTransitioning = false;
        this.transitionDuration = 1.5; // 기본 전환 시간 (초)
        this.easeType = 'easeInOutCubic'; // 기본 이징 함수
    }
    
    // 이징 함수들
    easingFunctions = {
        linear: (t) => t,
        easeInQuad: (t) => t * t,
        easeOutQuad: (t) => t * (2 - t),
        easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
        easeInCubic: (t) => t * t * t,
        easeOutCubic: (t) => (--t) * t * t + 1,
        easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
        easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2
    };
    
    // 카메라 전환
    transitionTo(targetPosition, targetRotation, targetFov, options = {}) {
        if (this.isTransitioning) {
            console.warn('[CameraTransition] 이미 전환 중입니다.');
            return Promise.resolve();
        }
        
        return new Promise((resolve) => {
            const {
                duration = this.transitionDuration,
                easeType = this.easeType,
                lookAt = null,
                onUpdate = null,
                onComplete = null
            } = options;
            
            this.isTransitioning = true;
            
            // 시작 상태 저장
            const startPosition = this.camera.position.clone();
            const startQuaternion = this.camera.quaternion.clone();
            const startFov = this.camera.fov;
            
            // 타겟 설정
            const endPosition = targetPosition.clone();
            let endQuaternion;
            
            if (lookAt) {
                // lookAt 포인트가 주어진 경우
                const tempCamera = this.camera.clone();
                tempCamera.position.copy(endPosition);
                tempCamera.lookAt(lookAt);
                endQuaternion = tempCamera.quaternion.clone();
            } else if (targetRotation) {
                // 회전이 주어진 경우
                endQuaternion = targetRotation.clone();
            } else {
                // 현재 회전 유지
                endQuaternion = startQuaternion.clone();
            }
            
            const startTime = performance.now();
            const ease = this.easingFunctions[easeType] || this.easingFunctions.easeInOutCubic;
            
            const animate = () => {
                const currentTime = performance.now();
                const elapsed = (currentTime - startTime) / 1000; // 초 단위
                const progress = Math.min(elapsed / duration, 1);
                const easeProgress = ease(progress);
                
                // 위치 보간
                this.camera.position.lerpVectors(startPosition, endPosition, easeProgress);
                
                // 회전 보간 (Quaternion slerp)
                this.camera.quaternion.slerpQuaternions(startQuaternion, endQuaternion, easeProgress);
                
                // FOV 보간
                if (targetFov !== undefined && targetFov !== startFov) {
                    this.camera.fov = startFov + (targetFov - startFov) * easeProgress;
                    this.camera.updateProjectionMatrix();
                }
                
                // OrbitControls 타겟 업데이트
                if (this.controls && lookAt) {
                    const startTarget = this.controls.target.clone();
                    this.controls.target.lerpVectors(startTarget, lookAt, easeProgress);
                }
                
                // 콜백 실행
                if (onUpdate) {
                    onUpdate(progress, easeProgress);
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.isTransitioning = false;
                    if (onComplete) onComplete();
                    resolve();
                }
            };
            
            animate();
        });
    }
    
    // GLTF 카메라로 전환
    transitionToGLTFCamera(gltfCamera, options = {}) {
        // GLTF 카메라의 월드 위치와 회전 계산
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        
        gltfCamera.matrixWorld.decompose(position, quaternion, scale);
        
        // 카메라가 바라보는 방향 계산
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(quaternion);
        const lookAt = position.clone().add(direction.multiplyScalar(10));
        
        return this.transitionTo(
            position,
            quaternion,
            gltfCamera.fov,
            {
                ...options,
                lookAt: lookAt
            }
        );
    }
    
    // 모델을 중심으로 하는 궤도 카메라 이동
    orbitAroundModel(model, options = {}) {
        const {
            radius = 20,
            height = 10,
            angle = 0, // 라디안
            duration = 2,
            lookAtCenter = true
        } = options;
        
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        
        // 목표 위치 계산
        const targetPosition = new THREE.Vector3(
            center.x + radius * Math.cos(angle),
            center.y + height,
            center.z + radius * Math.sin(angle)
        );
        
        return this.transitionTo(
            targetPosition,
            null,
            this.camera.fov,
            {
                duration,
                lookAt: lookAtCenter ? center : null
            }
        );
    }
    
    // 특정 오브젝트에 포커스
    focusOnObject(object, options = {}) {
        const {
            distance = 'auto',
            offset = new THREE.Vector3(0, 0, 0),
            duration = 1.5
        } = options;
        
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // 자동 거리 계산
        let cameraDistance = distance;
        if (distance === 'auto') {
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = this.camera.fov * (Math.PI / 180);
            cameraDistance = Math.abs(maxDim / Math.sin(fov / 2)) * 1.5;
        }
        
        // 카메라 위치 계산
        const direction = new THREE.Vector3(0.5, 0.5, 1).normalize();
        const targetPosition = center.clone()
            .add(direction.multiplyScalar(cameraDistance))
            .add(offset);
        
        return this.transitionTo(
            targetPosition,
            null,
            this.camera.fov,
            {
                duration,
                lookAt: center
            }
        );
    }
    
    // 현재 상태 저장
    saveState() {
        return {
            position: this.camera.position.clone(),
            quaternion: this.camera.quaternion.clone(),
            fov: this.camera.fov,
            controlsTarget: this.controls ? this.controls.target.clone() : null
        };
    }
    
    // 저장된 상태로 복원
    restoreState(state, options = {}) {
        return this.transitionTo(
            state.position,
            state.quaternion,
            state.fov,
            {
                ...options,
                lookAt: state.controlsTarget
            }
        );
    }
    
    // 전환 중단
    cancelTransition() {
        this.isTransitioning = false;
    }
    
    // 전환 설정
    setTransitionDuration(duration) {
        this.transitionDuration = duration;
    }
    
    setEaseType(easeType) {
        if (this.easingFunctions[easeType]) {
            this.easeType = easeType;
        } else {
            console.warn(`[CameraTransition] 알 수 없는 이징 타입: ${easeType}`);
        }
    }
    
    // 카메라 전환 힌트 표시
    showHint(message) {
        const existingHint = document.querySelector('.camera-hint');
        if (existingHint) {
            existingHint.remove();
        }
        
        const hint = document.createElement('div');
        hint.className = 'camera-hint';
        hint.textContent = message;
        hint.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 123, 255, 0.9);
            color: white;
            padding: 12px 24px;
            border-radius: 24px;
            font-size: 14px;
            pointer-events: none;
            z-index: 1000;
            animation: camera-transition-hint 2s ease-out;
        `;
        document.body.appendChild(hint);
        
        setTimeout(() => {
            hint.remove();
        }, 2000);
    }
}