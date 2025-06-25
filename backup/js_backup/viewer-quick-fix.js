// viewer-quick-fix.js
// viewer.html의 일반적인 오류를 빠르게 수정하는 스크립트
// 브라우저 콘솔에서 실행하거나 viewer.html에 추가

(function() {
    console.log('🔧 Viewer Quick Fix 스크립트 실행 중...');
    
    // 1. CONFIG 확인 및 기본값 설정
    if (typeof CONFIG === 'undefined') {
        console.warn('CONFIG가 없습니다. 기본값 생성...');
        window.CONFIG = {
            modelsPath: 'gltf/',
            models: [
                {
                    name: '블록 옹벽',
                    folder: 'Block_Retaining_Wall',
                    fileName: 'Block_Retaining_Wall.gltf',
                    icon: '🧱',
                    description: '블록식 옹벽 구조'
                },
                {
                    name: '캔틸레버 옹벽',
                    folder: 'Cantilever_Retaining_Wall',
                    fileName: 'Cantilever_Retaining_Wall.gltf',
                    icon: '🏗️',
                    description: '캔틸레버식 옹벽 구조'
                },
                {
                    name: 'MSE 옹벽',
                    folder: 'mse_Retaining_Wall',
                    fileName: 'mse_Retaining_Wall.gltf',
                    icon: '🏛️',
                    description: 'MSE 옹벽'
                }
            ],
            debug: true,
            camera: {
                fov: 75,
                near: 0.1,
                far: 1000,
                position: { x: 10, y: 8, z: 15 }
            },
            renderer: {
                antialias: true,
                shadowMapEnabled: true,
                shadowMapType: THREE.PCFSoftShadowMap,
                toneMappingExposure: 1.2
            },
            lights: {
                ambient: { color: 0xffffff, intensity: 0.8 },
                directional: { 
                    color: 0xffffff, 
                    intensity: 1.2,
                    position: { x: 10, y: 20, z: 10 }
                }
            }
        };
        console.log('✅ CONFIG 생성 완료');
    }
    
    // 2. 누락된 DOM 요소 생성
    function ensureDOMElement(id, parent = document.body, html = '') {
        if (!document.getElementById(id)) {
            console.log(`DOM 요소 생성: ${id}`);
            const element = document.createElement('div');
            element.id = id;
            element.innerHTML = html;
            parent.appendChild(element);
        }
    }
    
    // 필수 DOM 요소 확인
    ensureDOMElement('error', document.body, '');
    ensureDOMElement('loading', document.body, `
        <div class="loading-spinner"></div>
        <div>모델을 로딩중입니다...</div>
    `);
    
    // 3. Three.js 로드 확인
    if (typeof THREE === 'undefined') {
        console.error('❌ Three.js가 로드되지 않았습니다!');
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
        script.onload = () => {
            console.log('✅ Three.js 로드 완료');
            checkGLTFLoader();
        };
        document.head.appendChild(script);
    } else {
        console.log('✅ Three.js 확인됨');
        checkGLTFLoader();
    }
    
    // 4. GLTFLoader 확인
    function checkGLTFLoader() {
        if (typeof THREE.GLTFLoader === 'undefined') {
            console.warn('GLTFLoader 로드 중...');
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
            script.onload = () => {
                console.log('✅ GLTFLoader 로드 완료');
                checkOrbitControls();
            };
            document.head.appendChild(script);
        } else {
            checkOrbitControls();
        }
    }
    
    // 5. OrbitControls 확인
    function checkOrbitControls() {
        if (typeof THREE.OrbitControls === 'undefined') {
            console.warn('OrbitControls 로드 중...');
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
            script.onload = () => {
                console.log('✅ OrbitControls 로드 완료');
                finalCheck();
            };
            document.head.appendChild(script);
        } else {
            finalCheck();
        }
    }
    
    // 6. 최종 확인 및 앱 재시작
    function finalCheck() {
        console.log('\n=== 시스템 상태 ===');
        console.log('Three.js:', typeof THREE !== 'undefined' ? '✅' : '❌');
        console.log('GLTFLoader:', typeof THREE?.GLTFLoader !== 'undefined' ? '✅' : '❌');
        console.log('OrbitControls:', typeof THREE?.OrbitControls !== 'undefined' ? '✅' : '❌');
        console.log('CONFIG:', typeof CONFIG !== 'undefined' ? '✅' : '❌');
        console.log('viewerApp:', typeof viewerApp !== 'undefined' ? '✅' : '❌');
        
        // viewerApp이 없으면 재시작 시도
        if (typeof viewerApp === 'undefined' && typeof init === 'function') {
            console.log('\n앱 재시작 시도...');
            setTimeout(() => {
                init();
            }, 1000);
        }
    }
    
    // 7. 에러 핸들러 추가
    window.addEventListener('error', function(e) {
        console.error('🔴 오류 발생:', e.message);
        console.error('파일:', e.filename);
        console.error('라인:', e.lineno);
        
        // 일반적인 오류 패턴과 해결책
        if (e.message.includes('Cannot read property') && e.message.includes('of undefined')) {
            console.log('💡 해결 팁: null 체크를 추가하세요');
        }
        
        if (e.message.includes('is not a function')) {
            console.log('💡 해결 팁: 함수가 정의되었는지 확인하세요');
        }
        
        if (e.message.includes('Failed to fetch') || e.message.includes('404')) {
            console.log('💡 해결 팁: 파일 경로를 확인하세요');
        }
    });
    
    // 8. 디버그 도구 추가
    window.viewerDebug = {
        showState: function() {
            console.log('\n=== 현재 상태 ===');
            if (window.viewerApp) {
                console.log('SceneManager:', viewerApp.sceneManager ? '✅' : '❌');
                console.log('ModelLoader:', viewerApp.modelLoader ? '✅' : '❌');
                console.log('UIController:', viewerApp.uiController ? '✅' : '❌');
                console.log('AnimationController:', viewerApp.animationController ? '✅' : '❌');
                console.log('HotspotManager:', viewerApp.hotspotManager ? '✅' : '❌');
                
                if (viewerApp.sceneManager) {
                    console.log('Camera:', viewerApp.sceneManager.camera);
                    console.log('Scene children:', viewerApp.sceneManager.scene.children.length);
                }
            } else {
                console.log('viewerApp이 초기화되지 않았습니다.');
            }
        },
        
        reloadApp: function() {
            console.log('앱 재로드 중...');
            location.reload();
        },
        
        testModelLoad: function(index = 0) {
            if (window.viewerApp?.uiController && CONFIG?.models?.[index]) {
                console.log(`모델 ${index} 로드 시도...`);
                viewerApp.uiController.selectModel(CONFIG.models[index]);
            } else {
                console.error('앱이 준비되지 않았습니다.');
            }
        },
        
        fixPanels: function() {
            // 패널 표시 문제 수정
            const panels = ['right-panel', 'bottom-controls'];
            panels.forEach(id => {
                const panel = document.getElementById(id);
                if (panel) {
                    panel.style.display = 'flex';
                    console.log(`${id} 표시됨`);
                }
            });
        }
    };
    
    console.log('\n✅ Quick Fix 완료!');
    console.log('디버그 명령어:');
    console.log('- viewerDebug.showState() : 현재 상태 확인');
    console.log('- viewerDebug.testModelLoad(0) : 모델 로드 테스트');
    console.log('- viewerDebug.fixPanels() : 패널 표시 수정');
    console.log('- viewerDebug.reloadApp() : 앱 재로드');
    
})();