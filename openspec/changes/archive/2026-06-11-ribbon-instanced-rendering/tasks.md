## 1. Effect 与渲染组件

- [x] 1.1 新增 2D `assets/Effect/Ribbon/ribbon.effect`：`gl_Position = cc_matViewProj * a_position`，片元 `fract(u)` 平铺、texture + alpha
- [x] 1.2 新增 `RibbonAssembler`：连续三角带顶点（pos2+uv2）填充、本地→世界变换、strip 索引
- [x] 1.3 新增 `RibbonRender`（`cc.RenderComponent`）：材质激活、setRenderData + setVertsDirty

## 2. RibbonInstance 核心

- [x] 2.1 新增 `RibbonInstance.ts`，参数 `points` / `texture` / `width` / `subdivisions`
- [x] 2.2 Catmull-Rom 样条细分平滑路径（`_buildSmoothPath`，cc.v2 对象池复用）
- [x] 2.3 CPU 计算累积弧长 U、每点斜接法线/缩放（端点退化、MITER_LIMIT 钳制）
- [x] 2.4 每点生成左右两顶点（含 UV），复用 positions/uvs 数组喂给 RibbonRender
- [x] 2.5 纹理 packable=false + wrap=repeat；边界：points < 2 不绘制、变化时重建

## 3. 测试组件

- [x] 3.1 新增 `RibbonTest.ts`：构造平滑折线路径，验证绘制
- [x] 3.2 验证转角平滑、段间无缝（含 MSAA 开启）
- [x] 3.3 验证纹理沿路径按弧长平铺、不随总长拉伸

## 4. 验证

- [x] 4.1 确认整条丝带单次 draw call（drawcall 不随段数增长）
- [x] 4.2 动态路径（拖尾）每帧更新，稳态无每帧 GC
- [x] 4.3 运行 `openspec validate ribbon-instanced-rendering --strict` 通过
