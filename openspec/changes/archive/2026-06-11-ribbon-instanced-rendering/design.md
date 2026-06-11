# 设计：连续三角带路径丝带

## 架构选择

逐段独立四边形（含逐段实例化）无法做到无缝：相邻段不共享顶点，半透明 + MSAA 下接缝处覆盖率不互补（透出背景），重叠又叠色。故采用**连续三角带**：每个路径点生成左右两顶点，相邻段共享顶点 → 几何水密、MSAA 无缝。

沿用项目既有 2D 渲染范式（参考 `assets/Script/Core/GLRender/`）：
- `RibbonRender`：自定义 `cc.RenderComponent`。
- `RibbonAssembler`：自定义 `cc.Assembler`，把顶点写入 2D 渲染 buffer（`getBuffer('mesh', pos2+uv2)`），单次 draw call。
- `RibbonInstance`：上层逻辑，计算几何并喂给 `RibbonRender`。
- `ribbon.effect`：2D effect，`gl_Position = cc_matViewProj * a_position`（顶点为世界坐标，assembler 已烘焙世界变换）。

## 路径平滑（Catmull-Rom）

输入折线 `points` 经 Catmull-Rom 样条按 `subdivisions` 细分为平滑曲线（`_buildSmoothPath`）：
- 样条经过所有原始控制点；端点用控制点复制（clamp）处理。
- 细分后点数 N = (M-1)·subdivisions + 1；细分点缓冲 `_smoothPts` 复用（cc.v2 对象池），稳态零 GC。
- `subdivisions = 1` 时跳过平滑，退化为原始折线（尖角）。

下文「斜接 / U / 顶点」均作用在平滑后的点序列上。

## 顶点生成（每点左右两顶点）

对每个点 Pi（法线 miterN_i、缩放 scale_i）：
```
L_i = Pi + miterN_i * (width*0.5) * scale_i      // 左顶点，UV=(u_i, 0)
R_i = Pi - miterN_i * (width*0.5) * scale_i      // 右顶点，UV=(u_i, 1)
```
顶点序列 L0,R0,L1,R1,...；段 i 的两个三角形：(L_i,R_i,L_{i+1})、(R_i,R_{i+1},L_{i+1})。顶点 L_{i+1}/R_{i+1} 同时被段 i 和段 i+1 引用 → **共享顶点、无缝**。

## 斜接（miter）

对内部点 Pi，前段法线 n_in、后段法线 n_out（均 perp(dir)）：
```
m     = normalize(n_in + n_out)        // 角平分方向
scale = 1 / dot(m, n_in)               // 补偿斜接拉伸
```
- 端点（首/尾）退化为段法线（scale=1）；近 180° 折返退化为出向段法线。
- **锐角钳制**：scale 超过 `MITER_LIMIT`（默认 20）时钳制，避免尖刺无限延伸。
- 在平滑路径上，相邻细分段夹角极小，scale≈1，基本不触发钳制。

## 纹理沿路径平铺（U 映射）

- CPU 累积弧长：`len[i] = len[i-1] + |Pi - Pi-1|`；`u_i = len[i] / tileLength`。
- 左右顶点同 U=u_i，V 分别 0/1。相邻点 U 单调连续 → 纹理沿路径连续。
- 平铺由**硬件 wrap=REPEAT** 完成（不用 shader `fract`，避免跳变接缝）；纹理设 `packable=false` + wrap=REPEAT，`tileLength` 默认取纹理宽度（按宽度方向等比）。
- 前提：WebGL2 支持 NPOT REPEAT；WebGL1 需 POT 纹理。理想情况下纹理横向可平铺（左右边匹配）。

## 顶点缓冲与索引

- 顶点格式 pos2 + uv2（与 GLAssembler 一致），顶点数 = 2N。
- `RibbonAssembler.fillBuffers`：本地坐标经 `node._worldMatrix` 仿射变换为世界坐标写入；strip 索引每段 6 个。
- **16 位索引分块**：2D 渲染 buffer 为 Uint16 索引，单批顶点 ≤ 65535（约 32767 点）。`fillBuffers` 按 `MAX_POINTS_PER_CHUNK`（16384 点/块）分块多次 `request`，块间共享边界点（下一块从上一块末点开始）保证三角带连续，从而支持任意点数。
- `RibbonInstance` 复用 `_positions` / `_uvs` 数组，`points` 变化时重算并 `setVertsDirty`。

## 坐标空间

`points` 为节点本地坐标；assembler 应用节点世界矩阵 → 世界坐标，effect 仅做 `cc_matViewProj`。

## 风险与取舍

- 锐角处按 MITER_LIMIT 钳制会有轻微形变（可接受）。
- **内侧折叠防护**：当局部曲率半径 R 小于半宽时，宽丝带内侧会折叠自交（破碎）。故按 `R = segLen/(2 sin(turn/2))` 估算曲率半径，将顶点偏移钳制到 `0.9R`——急转弯处丝带略收窄而非破碎。极端急转（R≪半宽）时丝带在拐角会明显变细，属预期取舍。
- 自相交路径不做特殊处理（叠加混合即可）。
- 纹理需 `packable=false`（非图集）；平铺靠硬件 REPEAT，WebGL1 下须 POT 纹理，否则平铺边界出现细线接缝。
