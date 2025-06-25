// config.js - 전체 설정 파일
export const CONFIG = {
    // 디버그 모드
    debug: true,
    
    // 모델 경로 설정
    modelsPath: './gltf/',
    
    // 모델 목록
    models: [
        {
            name: '블록 옹벽',
            folder: 'Block_Retaining_Wall',
            fileName: 'Block_Retaining_Wall.gltf',
            icon: '🧱',
            description: '콘크리트 블록을 이용한 조립식 옹벽'
        },
        {
            name: '캔틸레버 옹벽',
            folder: 'Cantilever_Retaining_Wall',
            fileName: 'Cantilever_Retaining_Wall.gltf',
            icon: '🏗️',
            description: '철근 콘크리트 일체형 옹벽'
        },
        {
            name: 'MSE 옹벽',
            folder: 'mse_Retaining_Wall',
            fileName: 'mse_Retaining_Wall.gltf',
            icon: '🔧',
            description: '보강토 옹벽 (Mechanically Stabilized Earth)'
        }
    ],
    
    // 씬 설정
    scene: {
        backgroundColor: 0x1a1a1a,
        fogColor: 0x1a1a1a,
        fogNear: 50,
        fogFar: 200
    },
    
    // 카메라 설정
    camera: {
        fov: 45,
        near: 0.1,
        far: 1000,
        position: { x: 5, y: 5, z: 10 }
    },
    
    // OrbitControls 개선된 설정
    controls: {
        enabled: true,
        enableDamping: true,  // 부드러운 감속 효과 활성화
        dampingFactor: 0.1,   // 감속 강도 (0.05 ~ 0.25 권장)
        
        // 회전 설정
        rotateSpeed: 0.5,     // 기본값 1.0에서 감소
        autoRotate: false,
        autoRotateSpeed: 2.0,
        
        // 줌 설정
        enableZoom: true,
        zoomSpeed: 0.5,       // 기본값 1.0에서 감소
        minDistance: 2,
        maxDistance: 100,
        
        // 팬 설정
        enablePan: true,
        panSpeed: 0.5,        // 기본값 1.0에서 감소
        screenSpacePanning: true,
        
        // 각도 제한
        minPolarAngle: 0,
        maxPolarAngle: Math.PI,
        minAzimuthAngle: -Infinity,
        maxAzimuthAngle: Infinity,
        
        // 관성 설정
        enableKeys: true,
        keys: {
            LEFT: 'ArrowLeft',
            UP: 'ArrowUp',
            RIGHT: 'ArrowRight',
            BOTTOM: 'ArrowDown'
        },
        
        // 마우스 버튼 설정
        mouseButtons: {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
        }
    },
    
    // 카메라별 개별 설정 (새로운 기능)
    cameraProfiles: {
        default: {
            rotateSpeed: 0.5,
            zoomSpeed: 0.5,
            panSpeed: 0.5,
            dampingFactor: 0.1
        },
        closeup: {  // 근접 촬영용
            rotateSpeed: 0.3,
            zoomSpeed: 0.3,
            panSpeed: 0.3,
            dampingFactor: 0.15
        },
        overview: {  // 전체 뷰용
            rotateSpeed: 0.7,
            zoomSpeed: 0.7,
            panSpeed: 0.7,
            dampingFactor: 0.08
        },
        gltf: {  // GLTF 카메라용
            rotateSpeed: 0.4,
            zoomSpeed: 0.4,
            panSpeed: 0.4,
            dampingFactor: 0.12
        }
    },
    
    // 적응형 속도 설정 (새로운 기능)
    adaptiveSpeed: {
        enabled: true,
        minDistance: 5,      // 이 거리 이하에서는 최소 속도
        maxDistance: 50,     // 이 거리 이상에서는 최대 속도
        speedMultiplier: {
            min: 0.5,        // 최소 속도 배수
            max: 1.5         // 최대 속도 배수
        }
    },
    
    // 렌더러 설정
    renderer: {
        antialias: true,
        shadowMapEnabled: true,
        shadowMapType: THREE.PCFSoftShadowMap,
        toneMappingExposure: 1.2
    },
    
    // 조명 설정
    lights: {
        ambient: {
            color: 0xffffff,
            intensity: 0.6
        },
        directional: {
            color: 0xffffff,
            intensity: 0.8,
            position: { x: 5, y: 10, z: 5 },
            castShadow: true,
            shadow: {
                mapSize: 2048,
                camera: {
                    near: 0.5,
                    far: 50,
                    left: -10,
                    right: 10,
                    top: 10,
                    bottom: -10
                }
            }
        }
    },
    
    // 환경 설정
    environment: {
        grid: {
            size: 100,
            divisions: 50,
            color1: 0x444444,
            color2: 0x222222
        },
        floor: {
            size: 100,
            color: 0x1a1a1a,
            visible: true
        }
    },
    
    // 카메라 전환 설정 (새로운 기능)
    cameraTransition: {
        defaultDuration: 1.5,
        defaultEaseType: 'easeInOutCubic',
        disableControlsDuringTransition: true
    },
    
    // UI 설정
    ui: {
        defaultPanelState: 'open',
        animationSpeed: 300,
        hotspotSize: 32,
        hotspotColor: '#00ff88'
    },
    
    // 애니메이션 설정
    animation: {
        defaultFPS: 60,
        showFPSCounter: true
    }
};