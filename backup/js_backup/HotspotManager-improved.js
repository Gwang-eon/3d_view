// HotspotManager-improved.js
// 기존 HotspotManager를 상속받아 개선된 버전 생성
import { HotspotManager as BaseHotspotManager } from './HotspotManager.js';

export class HotspotManager extends BaseHotspotManager {
    constructor(sceneManager) {
        super(sceneManager);
        console.log('[HotspotManager-improved] 초기화');
    }
    
    // 기존 기능을 그대로 사용하면서 필요한 부분만 오버라이드
}