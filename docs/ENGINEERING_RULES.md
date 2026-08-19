# 工程约束

1. `src/game` 不依赖 Three.js 或 DOM。
2. `src/render` 只读取 GameState，不直接修改规则数据。
3. `src/ui` 通过 EventBus 发 command，不直接执行核心规则。
4. 国家与固定领袖绑定关系来自配置表；英雄招募池独立。
5. 每个英雄最多 3 个神器槽。
6. 野生精灵属于 TileState；捕获后进入 capturedPokemon，再允许绑定英雄。
7. 美术资源只通过稳定 ID 引用，不在规则代码写文件名。
8. 每个功能模块至少保留一个独立 System，避免再次形成单文件大脚本。
