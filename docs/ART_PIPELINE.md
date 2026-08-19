# 美术资源接入规范 v0.1

后续 image2 生图统一输出到 `public/assets` 对应目录。

## 命名
- 地形：`terrain_<biome>_<variant>_<size>.png`
- 英雄头像：`hero_<id>_portrait_v001.png`
- 精灵地图图标：`pokemon_<id>_map_v001.png`
- 神器图标：`artifact_<id>_icon_v001.png`
- UI：`ui_<module>_<element>_v001.png`

## 推荐规格
- 地形/地貌单体：1024×1024，透明背景或可平铺版本。
- 英雄立绘：1024×1536。
- 英雄头像：512×512。
- 精灵地图棋子：512×512 透明背景。
- 神器图标：512×512。
- UI 图标：256×256。
- UI 九宫格面板：1024×1024。

## 接入原则
原始生图先放 `assets/raw`（后续可增加），清理/裁切/统一尺寸后再进入 `public/assets`。
