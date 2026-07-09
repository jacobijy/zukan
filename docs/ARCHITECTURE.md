# 项目架构说明

## 目录结构

```
zukan/
├── src/
│   ├── core/                    # 核心业务逻辑（纯 TS，无平台依赖）
│   │   ├── data/                # 数据层
│   │   │   ├── enums/           # 枚举定义
│   │   │   ├── json/            # 优化后的 JSON 数据
│   │   │   ├── csv/             # 原始 CSV 数据（用于生成 JSON）
│   │   │   └── *.ts             # 数据访问入口
│   │   └── simulator/           # 战斗模拟器核心
│   │
│   ├── infra/                   # 基础设施层（平台特定实现）
│   │   ├── wasm/                # Rust WASM 模块
│   │   │   ├── src/             # Rust 源码
│   │   │   ├── Cargo.toml
│   │   │   └── pkg/             # 构建产物（gitignore）
│   │   └── flatbuffers/         # FlatBuffers 序列化
│   │       └── pokemon_data.fbs
│   │
│   ├── shared/                  # 共享层
│   │   ├── types/               # 全局类型定义
│   │   └── utils/               # 通用工具函数
│   │
│   ├── components/              # UI 组件
│   │   ├── common/              # 通用组件
│   │   └── pokemon/             # 宝可梦相关组件
│   │
│   ├── pages/                   # 页面路由
│   ├── services/                # 服务层（API、网络请求）
│   ├── store/                   # 状态管理（Pinia）
│   └── assets/                  # 静态资源（原 static/，待迁移）
│
├── tools/                       # 数据处理工具
│   ├── python/                  # Python 转换脚本
│   ├── typescript/              # TS 脚本
│   └── README.md
│
└── docs/                        # 文档
```

## 分层说明

### 1. Core Layer (核心层)
- 纯 TypeScript，不含任何平台特定代码
- 可独立测试，可在 Node.js 环境运行
- **不依赖 Vue、uni-app、WASM**

### 2. Infra Layer (基础设施层)
- 平台特定实现（WASM、FlatBuffers、原生插件）
- 提供给 Core 层调用的抽象接口
- WASM 用于：
  - 高性能加密解密
  - 大规模伤害计算
  - 模拟战斗回放

### 3. Shared Layer (共享层)
- 全局类型定义（集中一处）
- 无副作用的纯函数工具

### 4. UI Layer (UI层)
- components、pages、store、services
- Vue + uni-app 实现

## 数据流向

```
CSV (tools/) → JSON (core/data/json/) → FlatBuffers (infra/flatbuffers/)
                                                          ↓
                                                      WASM pkg
                                                          ↓
                  前端调用 → Infra Loader → Core Logic → UI Render
```

## 命名约定

- 目录名：**kebab-case**
- 文件名：**PascalCase** (类/组件)，**camelCase** (函数/普通文件)
- 常量：**UPPER_SNAKE_CASE**

## 待完成迁移

1. `static/` → `assets/` （uni-app 约束，暂缓）
2. `model/` + `pokemon.d.ts` → `shared/types/`
3. `utils/` → `shared/utils/`
4. 更新相关 import 路径
