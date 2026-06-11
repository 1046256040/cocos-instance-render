## Why

项目缺少沿路径绘制的丝带/拖尾渲染。逐段独立绘制（含逐段实例化）的半透明四边形无法做到无缝：相邻段不共享顶点，MSAA 下接缝处覆盖率不互补会透出背景，重叠又会叠色。要无缝、平滑、纹理沿路径平铺，连续三角带（共享顶点、单次 draw call）是标准做法。

> 备注：本变更初版尝试过 GPU 逐段实例化，因上述无缝问题改为连续三角带（评审决定）。

## What Changes

- 新增 `RibbonInstance`：输入 `points`（坐标数组）、`texture`（纹理）、`width`（宽度），生成沿路径的丝带。
- 路径经 Catmull-Rom 样条按 `subdivisions` 细分为平滑曲线（转角平滑过渡，`subdivisions=1` 退化为折线）。
- 每个（细分）点据斜接（miter）法线生成左右两个顶点，相邻段**共享顶点**组成连续 triangle-strip；通过自定义 2D `RenderComponent + Assembler` 单次 draw call 绘制。
- 纹理沿路径方向按弧长平铺重复（U = 累积弧长 / 平铺长度），片元用 `fract` 手动平铺，V 为带宽方向 0→1。
- 新增配套 2D `ribbon.effect`、`RibbonRender`、`RibbonAssembler` 与测试组件 `RibbonTest`。

## Capabilities

### New Capabilities
- `ribbon-rendering`: 基于连续三角带的路径丝带渲染，含路径平滑、纹理沿路径平铺与无缝衔接。

### Modified Capabilities
<!-- 无 -->

## Impact

- **新增代码**：`assets/Script/Core/Ribbon/`（`RibbonInstance.ts`、`RibbonRender.ts`、`RibbonAssembler.ts`）、`assets/Script/RibbonTest/RibbonTest.ts`、`assets/Effect/Ribbon/ribbon.effect`。
- **复用**：项目既有 2D `RenderComponent + Assembler` 范式（参考 GLRender / GLAssembler）。
- **drawcall / 内存**：整条丝带由 1 次 draw call 绘制；顶点数 = 2 × 细分点数，位置/UV 数组复用，稳态无每帧 GC。
- **约束**：纹理需非图集（`packable=false`）；锐角超 MITER_LIMIT 时按钳制处理，存在轻微形变。
