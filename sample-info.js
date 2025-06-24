{
    "name": "블록식 옹벽 샘플",
    "icon": "🧱",
    "description": "표준 블록식 옹벽 구조 모델",
    "metadata": {
        "version": "2.0",
        "author": "Engineering Team",
        "date": "2024-01-15",
        "scale": "1:100",
        "units": "meters"
    },
    "specifications": {
        "height": "6.0m",
        "length": "50.0m",
        "blockType": "Segmental Retaining Wall Units",
        "designLife": "75 years"
    },
    "features": [
        "배수 시스템 포함",
        "지오그리드 보강",
        "기초 안정화",
        "식생 블록 옵션"
    ],
    "hotspots": {
        "HS_DrainageSystem": {
            "title": "배수 시스템",
            "description": "침투수 배출을 위한 배수관",
            "icon": "💧",
            "data": {
                "type": "drainage",
                "diameter": "100mm",
                "material": "PVC"
            }
        },
        "HS_Geogrid": {
            "title": "지오그리드 보강재",
            "description": "토압 저항을 위한 보강재",
            "icon": "🔗",
            "data": {
                "type": "reinforcement",
                "strength": "150 kN/m",
                "spacing": "0.6m"
            }
        },
        "HS_Foundation": {
            "title": "기초부",
            "description": "옹벽 하부 기초 구조",
            "icon": "🏗️",
            "data": {
                "type": "foundation",
                "depth": "1.2m",
                "width": "3.0m"
            }
        }
    },
    "animations": {
        "construction_sequence": {
            "name": "시공 순서",
            "duration": 20,
            "description": "단계별 시공 과정 시뮬레이션"
        },
        "load_distribution": {
            "name": "하중 분포",
            "duration": 10,
            "description": "토압 및 상재하중 분포 시각화"
        },
        "drainage_flow": {
            "name": "배수 흐름",
            "duration": 15,
            "description": "우수 침투 및 배수 경로"
        }
    },
    "materials": {
        "blocks": {
            "type": "Concrete Masonry Units",
            "strength": "35 MPa",
            "weight": "35 kg/unit"
        },
        "backfill": {
            "type": "Granular Fill",
            "friction_angle": "32°",
            "unit_weight": "19 kN/m³"
        },
        "geogrid": {
            "type": "HDPE Geogrid",
            "tensile_strength": "150 kN/m",
            "elongation": "< 10%"
        }
    }
}