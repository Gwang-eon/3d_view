// MSE Wall Viewer Configuration
export const CONFIG = {
    // GLTF 모델 폴더 경로
    modelsPath: 'gltf/',
    // modelsPath: '/public/gltf/wall_viewer/gltf/',

    // 사용 가능한 모델 목록 (fileName 필수)
    models: [
        {
            name: '블록 옹벽',
            folder: 'Block_Retaining_Wall',
            fileName: 'Block_Retaining_Wall.gltf', // 파일명 명시
            icon: '🧱',
            description: '블록식 옹벽 구조'
        },
        {
            name: '캔틸레버 옹벽',
            folder: 'Cantilever_Retaining_Wall',
            fileName: 'Cantilever_Retaining_Wall.gltf', // 파일명 명시
            icon: '🏗️',
            description: '캔틸레버식 옹벽 구조'
        },
        {
            name: 'MSE 옹벽',
            folder: 'mse_Retaining_Wall',
            fileName: 'mse_Retaining_Wall.gltf', // 파일명 명시
            icon: '🏛️',
            description: 'MSE(기계적 안정 토양) 옹벽'
        }
    ],
    
    // Three.js 설정
    scene: {
        backgroundColor: 0x1a1a1a,
        fogColor: 0x1a1a1a,
        fogNear: 50,
        fogFar: 200
    },
    
    // 카메라 설정
    camera: {
        fov: 75,
        near: 0.1,
        far: 1000,
        position: { x: 10, y: 8, z: 15 }
    },
    
    // 렌더러 설정 - 개선된 설정
    renderer: {
        antialias: true,
        shadowMapEnabled: true,
        shadowMapType: THREE.PCFSoftShadowMap,
        toneMappingExposure: 1.2, // 밝기 증가
        physicallyCorrectLights: true // 물리적으로 정확한 조명
    },
    
    // 조명 설정 - 크게 개선
    lights: {
        // 환경광 - 전체적인 밝기 증가
        ambient: { 
            color: 0xffffff, 
            intensity: 0.8 // 0.6에서 0.8로 증가
        },
        
        // 주 방향광 - 그림자를 생성하는 메인 조명
        directional: { 
            color: 0xffffff, 
            intensity: 1.2, // 0.8에서 1.2로 증가
            position: { x: 10, y: 20, z: 10 }, // 위치 조정
            shadowMapSize: 4096,
            shadowCameraNear: 0.1,
            shadowCameraFar: 50,
            shadowCameraSize: 30, // 그림자 카메라 크기
            castShadow: true
        },
        
        // 보조 조명 - 그림자 부분을 밝게
        fill: { 
            color: 0xffffff, 
            intensity: 0.5, // 0.3에서 0.5로 증가
            position: { x: -10, y: 10, z: -10 }
        },
        
        // 반구광 - 자연스러운 조명
        hemisphere: { 
            skyColor: 0x87CEEB, 
            groundColor: 0x545454, 
            intensity: 0.5 // 0.3에서 0.5로 증가
        },
        
        // 추가 포인트 라이트 (새로 추가)
        point: {
            color: 0xffffff,
            intensity: 0.5,
            distance: 50,
            position: { x: 0, y: 15, z: 0 }
        }
    },
    
    // 컨트롤 설정
    controls: {
        enableDamping: true,
        dampingFactor: 0.05,
        screenSpacePanning: false,
        minDistance: 3,
        maxDistance: 50,
        maxPolarAngle: Math.PI / 2
    },

    // 기타 설정...
    grid: { 
        size: 30, // 크기 증가
        divisions: 30, // 분할 증가
        colorCenterLine: 0x444444, 
        colorGrid: 0x222222 
    },
    
    floor: { 
        size: 60, // 크기 증가
        color: 0x808080, // 더 밝은 색상
        roughness: 0.8, 
        metalness: 0.2,
        receiveShadow: true // 그림자 받기 명시
    },
    
    animation: { defaultFPS: 30 },
    hotspot: { defaultIcon: '📍', iconSize: 40, animationDuration: 2 },
    ui: { showFPS: true },
    
    // 개발 모드 설정
    debug: true // 디버그 모드 항상 활성화
};