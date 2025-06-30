// js/file-validator.js - 파일 존재 여부 검증 유틸리티

export class FileValidator {
    constructor() {
        this.cache = new Map();
        this.checkCache = new Map(); // 존재 여부 캐시
    }
    
    /**
     * 파일 존재 여부 확인
     * @param {string} filePath - 파일 경로
     * @returns {Promise<boolean>} 파일 존재 여부
     */
    async fileExists(filePath) {
        // 캐시 확인
        if (this.checkCache.has(filePath)) {
            return this.checkCache.get(filePath);
        }
        
        try {
            const response = await fetch(filePath, { method: 'HEAD' });
            const exists = response.ok;
            
            // 캐시에 저장
            this.checkCache.set(filePath, exists);
            
            if (exists) {
                console.log(`✅ 파일 존재 확인: ${filePath}`);
            } else {
                console.warn(`❌ 파일 없음: ${filePath} (${response.status})`);
            }
            
            return exists;
        } catch (error) {
            console.error(`🔍 파일 확인 오류: ${filePath}`, error);
            this.checkCache.set(filePath, false);
            return false;
        }
    }
    
    /**
     * 여러 파일 존재 여부 확인
     * @param {string[]} filePaths - 파일 경로 배열
     * @returns {Promise<Object>} 각 파일의 존재 여부
     */
    async checkMultipleFiles(filePaths) {
        const results = {};
        const promises = filePaths.map(async (path) => {
            results[path] = await this.fileExists(path);
        });
        
        await Promise.all(promises);
        return results;
    }
    
    /**
     * 모델 파일 검증 (GLTF + 프리뷰 + 핫스팟)
     * @param {string} modelPath - 모델 파일 경로
     * @returns {Promise<Object>} 검증 결과
     */
    async validateModelFiles(modelPath) {
        // 관련 파일 경로 생성
        const folderPath = modelPath.substring(0, modelPath.lastIndexOf('/'));
        const baseFileName = modelPath.substring(modelPath.lastIndexOf('/') + 1, modelPath.lastIndexOf('.'));
        
        const filesToCheck = {
            gltf: modelPath,
            preview: `${folderPath}/preview.jpg`,
            hotspots: `${folderPath}/hotspots.json`,
        //    alternativePreview: `${folderPath}/${baseFileName}.jpg`
        };
        
        console.log(`🔍 모델 파일 검증 시작: ${modelPath}`);
        
        const results = await this.checkMultipleFiles(Object.values(filesToCheck));
        
        const validation = {
            gltf: {
                path: filesToCheck.gltf,
                exists: results[filesToCheck.gltf],
                required: true
            },
            preview: {
                path: results[filesToCheck.preview] ? filesToCheck.preview : 
                       (results[filesToCheck.alternativePreview] ? filesToCheck.alternativePreview : null),
                exists: results[filesToCheck.preview] || results[filesToCheck.alternativePreview],
                required: false
            },
            hotspots: {
                path: filesToCheck.hotspots,
                exists: results[filesToCheck.hotspots],
                required: false
            }
        };
        
        // 검증 결과 로깅
        console.log('📋 파일 검증 결과:');
        Object.entries(validation).forEach(([type, info]) => {
            const status = info.exists ? '✅' : (info.required ? '❌' : '⚠️');
            const message = info.required && !info.exists ? ' (필수!)' : '';
            console.log(`  ${status} ${type}: ${info.exists ? info.path : '없음'}${message}`);
        });
        
        return validation;
    }
    
    /**
     * 모든 모델 파일 사전 검증
     * @param {Array} models - 모델 설정 배열
     * @param {string} basePath - 기본 경로
     * @returns {Promise<Object>} 전체 검증 결과
     */
    async validateAllModels(models, basePath) {
        console.log('🔍 전체 모델 파일 검증 시작...');
        
        const validationResults = {};
        const availableModels = [];
        const unavailableModels = [];
        
        for (const [index, model] of models.entries()) {
            const modelPath = `${basePath}${model.folder}/${model.fileName}`;
            
            try {
                const validation = await this.validateModelFiles(modelPath);
                validationResults[index] = {
                    model: model,
                    validation: validation,
                    isAvailable: validation.gltf.exists
                };
                
                if (validation.gltf.exists) {
                    availableModels.push(index);
                    console.log(`✅ 모델 ${index} (${model.name}): 사용 가능`);
                } else {
                    unavailableModels.push(index);
                    console.error(`❌ 모델 ${index} (${model.name}): GLTF 파일 없음`);
                }
            } catch (error) {
                console.error(`❌ 모델 ${index} (${model.name}) 검증 실패:`, error);
                validationResults[index] = {
                    model: model,
                    validation: null,
                    isAvailable: false,
                    error: error.message
                };
                unavailableModels.push(index);
            }
        }
        
        // 결과 요약
        console.log('\n📊 모델 검증 요약:');
        console.log(`  ✅ 사용 가능: ${availableModels.length}개`);
        console.log(`  ❌ 사용 불가: ${unavailableModels.length}개`);
        
        if (availableModels.length === 0) {
            throw new Error('사용 가능한 모델이 없습니다. gltf 폴더와 파일들을 확인해주세요.');
        }
        
        return {
            results: validationResults,
            availableModels,
            unavailableModels,
            totalCount: models.length,
            availableCount: availableModels.length
        };
    }
    
    /**
     * 폴백 파일 찾기
     * @param {string} originalPath - 원본 파일 경로
     * @param {string[]} alternatives - 대안 경로들
     * @returns {Promise<string|null>} 사용 가능한 파일 경로
     */
    async findFallbackFile(originalPath, alternatives = []) {
        // 원본 파일 먼저 확인
        if (await this.fileExists(originalPath)) {
            return originalPath;
        }
        
        // 대안 파일들 확인
        for (const altPath of alternatives) {
            if (await this.fileExists(altPath)) {
                console.log(`🔄 폴백 파일 사용: ${altPath}`);
                return altPath;
            }
        }
        
        console.warn(`⚠️ 폴백 파일을 찾을 수 없음: ${originalPath}`);
        return null;
    }
    
    /**
     * 캐시 초기화
     */
    clearCache() {
        this.cache.clear();
        this.checkCache.clear();
        console.log('🗑️ 파일 검증 캐시 초기화');
    }
    
    /**
     * 상세한 에러 정보 생성
     * @param {string} modelPath - 문제가 된 모델 경로
     * @param {Object} validation - 검증 결과
     * @returns {string} 사용자 친화적인 에러 메시지
     */
    generateErrorMessage(modelPath, validation) {
        if (!validation || !validation.gltf.exists) {
            return `모델 파일을 찾을 수 없습니다.\n경로: ${modelPath}\n\n해결 방법:\n1. gltf 폴더가 올바른 위치에 있는지 확인\n2. 파일명이 정확한지 확인\n3. 파일 권한을 확인`;
        }
        
        const missingFiles = [];
        if (!validation.preview.exists) missingFiles.push('프리뷰 이미지');
        if (!validation.hotspots.exists) missingFiles.push('핫스팟 데이터');
        
        if (missingFiles.length > 0) {
            return `일부 선택적 파일이 없습니다: ${missingFiles.join(', ')}\n모델은 정상적으로 로드되지만 일부 기능이 제한될 수 있습니다.`;
        }
        
        return '알 수 없는 파일 검증 오류가 발생했습니다.';
    }
}

// 전역 인스턴스 생성
export const fileValidator = new FileValidator();