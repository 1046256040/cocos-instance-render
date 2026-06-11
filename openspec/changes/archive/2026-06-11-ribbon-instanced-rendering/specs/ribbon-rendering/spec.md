## ADDED Requirements

### Requirement: 路径丝带绘制
系统 SHALL 接受 `points`（坐标数组）、`texture`（纹理）、`width`（宽度）三个参数，沿路径绘制一条带宽度的丝带，并以单次 draw call 完成（连续三角带）。

#### Scenario: 多段路径单 drawcall
- **WHEN** 传入含 M 个点的 `points`（M ≥ 2）
- **THEN** 整条丝带以 1 次 draw call 绘制（连续 triangle-strip），drawcall 数不随段数增长

#### Scenario: 点数不足
- **WHEN** `points` 少于 2 个点
- **THEN** 不绘制任何内容且不报错

#### Scenario: 宽度生效
- **WHEN** 指定宽度 `width = w`
- **THEN** 丝带在路径法线方向的总宽度为 `w`，居中于路径中线

#### Scenario: 大点数超 16 位索引上限
- **WHEN** 顶点数超过单批 16 位索引上限（约 32767 点）
- **THEN** 按块分多次提交、块间共享边界点，丝带仍完整连续显示，不会整体消失

### Requirement: 纹理沿路径平铺
纹理 SHALL 沿路径方向按弧长平铺重复：U = 累积弧长 / 平铺长度，V 为带宽方向 0→1，纹理横向采样 wrap 为 repeat。

#### Scenario: 等比平铺不拉伸
- **WHEN** 路径总弧长为平铺长度的 K 倍
- **THEN** 纹理沿路径重复约 K 次，纹理比例不随丝带总长被拉伸

### Requirement: 拐角平滑过渡与无缝衔接
路径 SHALL 经 Catmull-Rom 样条按 `subdivisions` 细分为平滑曲线后再渲染，使转角呈平滑过渡；每个点据斜接（miter）法线生成左右两顶点，相邻段**共享这两个顶点**组成连续三角带，保证几何无缝（含 MSAA）且 U 坐标连续。

#### Scenario: 转弯处平滑
- **WHEN** 路径在某点发生转向且 `subdivisions > 1`
- **THEN** 该转角渲染为平滑弧线（无尖角），曲线经过原始控制点，纹理沿弧线平滑过渡

#### Scenario: 关闭平滑退化为折线
- **WHEN** `subdivisions = 1`
- **THEN** 按原始折线渲染，拐角为尖角且 U 连续

#### Scenario: 段间无缝（含 MSAA）
- **WHEN** 开启 MSAA 抗锯齿渲染丝带
- **THEN** 相邻段因共享顶点而无接缝（无透出背景的细缝、无重叠叠色），U 值在共享点一致

### Requirement: 动态更新与零稳态 GC
当 `points` 变化时，系统 SHALL 重建顶点数据并标记重绘；平滑点与顶点/UV 数组复用。

#### Scenario: 路径动态变化
- **WHEN** 每帧更新 `points`（如拖尾）并重新提交
- **THEN** 丝带正确刷新，且点数未超出当前容量时稳态无每帧堆分配
