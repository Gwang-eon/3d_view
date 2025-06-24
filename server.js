// 옹벽 3D 뷰어 - Development Server
// 이 서버는 로컬 개발 시 GLTF 폴더를 자동으로 스캔하기 위해 사용됩니다.
// 운영 환경에서는 정적 파일 서버나 CDN을 사용하세요.

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 설정
app.use(cors());

// 정적 파일 제공
app.use(express.static('.'));

// GLTF 폴더 목록 API
app.get('/gltf/list.json', async (req, res) => {
    try {
        const gltfPath = path.join(__dirname, 'gltf');
        const folders = await fs.readdir(gltfPath, { withFileTypes: true });
        
        const models = [];
        
        for (const folder of folders) {
            if (folder.isDirectory()) {
                const folderPath = path.join(gltfPath, folder.name);
                const files = await fs.readdir(folderPath);
                
                // GLTF 파일이 있는지 확인
                const hasGltf = files.some(file => 
                    file.endsWith('.gltf') || file.endsWith('.glb')
                );
                
                if (hasGltf) {
                    // 모델 정보 파일 읽기 (있는 경우)
                    let modelInfo = {
                        name: folder.name.replace(/_/g, ' ').replace(/-/g, ' ')
                            .replace(/\b\w/g, l => l.toUpperCase()),
                        folder: folder.name,
                        icon: '🏗️',
                        description: 'GLTF 3D 모델'
                    };
                    
                    try {
                        const infoPath = path.join(folderPath, 'info.json');
                        const infoContent = await fs.readFile(infoPath, 'utf8');
                        const customInfo = JSON.parse(infoContent);
                        modelInfo = { ...modelInfo, ...customInfo };
                    } catch (e) {
                        // info.json이 없어도 기본 정보 사용
                    }
                    
                    models.push(modelInfo);
                }
            }
        }
        
        res.json(models);
        
    } catch (error) {
        console.error('폴더 스캔 오류:', error);
        res.status(500).json({ error: '폴더 스캔 실패' });
    }
});

// 특정 폴더의 파일 목록 API
app.get('/gltf/:folder/files.json', async (req, res) => {
    try {
        const folderPath = path.join(__dirname, 'gltf', req.params.folder);
        const files = await fs.readdir(folderPath);
        
        // GLTF/GLB 파일만 필터링
        const gltfFiles = files.filter(file => 
            file.endsWith('.gltf') || file.endsWith('.glb')
        );
        
        console.log(`폴더 ${req.params.folder}의 GLTF 파일:`, gltfFiles);
        
        res.json(gltfFiles);
        
    } catch (error) {
        console.error('파일 목록 오류:', error);
        res.status(500).json({ error: '파일 목록 조회 실패' });
    }
});

// 서버 시작
app.listen(PORT, async () => {
    console.log(`옹벽 3D 뷰어 서버가 포트 ${PORT}에서 실행중입니다.`);
    console.log(`http://localhost:${PORT} 에서 접속하세요.`);
    console.log('\n사용 방법:');
    console.log('1. gltf/ 폴더에 GLTF 모델 폴더들을 넣으세요.');
    console.log('2. 각 모델 폴더에는 .gltf 또는 .glb 파일이 있어야 합니다.');
    console.log('3. 선택적으로 info.json 파일을 추가하여 모델 정보를 커스터마이즈할 수 있습니다.');
    
    // GLTF 폴더 스캔
    console.log('\n=== GLTF 폴더 스캔 결과 ===');
    try {
        const gltfPath = path.join(__dirname, 'gltf');
        const folders = await fs.readdir(gltfPath, { withFileTypes: true });
        
        for (const folder of folders) {
            if (folder.isDirectory()) {
                const folderPath = path.join(gltfPath, folder.name);
                const files = await fs.readdir(folderPath);
                const gltfFiles = files.filter(f => f.endsWith('.gltf') || f.endsWith('.glb'));
                
                console.log(`\n📁 ${folder.name}/`);
                if (gltfFiles.length > 0) {
                    gltfFiles.forEach(file => {
                        console.log(`  ✓ ${file}`);
                    });
                } else {
                    console.log(`  ⚠️  GLTF/GLB 파일 없음`);
                    console.log(`  파일 목록: ${files.join(', ') || '(빈 폴더)'}`);
                }
            }
        }
    } catch (error) {
        console.error('GLTF 폴더 스캔 실패:', error);
    }
    console.log('========================\n');
});

// info.json 예제
const infoExample = {
    "name": "블록식 옹벽",
    "icon": "🧱",
    "description": "프리캐스트 블록을 활용한 옹벽 구조",
    "metadata": {
        "version": "1.0",
        "author": "Example Corp",
        "date": "2024-01-01"
    }
};

// 시작 시 예제 출력
console.log('\ninfo.json 예제:');
console.log(JSON.stringify(infoExample, null, 2));