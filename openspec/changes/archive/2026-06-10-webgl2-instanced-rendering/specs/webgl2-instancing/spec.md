## ADDED Requirements

### Requirement: 基于 WebGL2 原生 API 的实例化绘制
在 WebGL2 模式下，实例化渲染 MUST 使用原生 `vertexAttribDivisor` 与 `drawArraysInstanced` / `drawElementsInstanced`，不得依赖 `ANGLE_instanced_arrays` 扩展。

#### Scenario: 同构对象批量绘制
- **WHEN** 一批 N 个同构对象通过实例化路径提交渲染
- **THEN** GPU 以单次实例化 drawcall 完成绘制，drawcall 数为 1（不随 N 增长）

#### Scenario: WebGL1 兜底
- **WHEN** 设备处于 WebGL1 模式
- **THEN** 实例化改走 `ANGLE_instanced_arrays` 路径，绘制结果与 WebGL2 路径一致

### Requirement: 实例属性流管理
实例化路径 MUST 通过独立顶点流（divisor=1）传递每实例属性。仅当实例流 / program / 缓冲发生变化时才重设顶点属性指针（沿用引擎 `attrsDirty` 门控），避免每帧重复设置。

#### Scenario: 设置每实例属性
- **WHEN** 上传 N 个实例的变换/颜色等属性
- **THEN** 这些属性写入 divisor=1 的实例 VBO，每个实例读取对应一份属性

#### Scenario: 容量自适应
- **WHEN** 实例数超过当前实例 VBO 容量
- **THEN** 实例 VBO 按 2 倍策略扩容，扩容不影响绘制正确性，且每帧无新增 GC（复用 Float32Array）

### Requirement: InstanceBatchRenderer 双路径透明适配
`InstanceBatchRenderer` 对外 API MUST 保持不变，内部依据 `device.webgl2` 自动选择 WebGL2 原生或 WebGL1 ANGLE 路径。

#### Scenario: 调用方无感知切换
- **WHEN** 业务代码以相同方式调用 `upload(data, count)`
- **THEN** 在 WebGL1 与 WebGL2 环境下均正确渲染，调用方代码无需改动

### Requirement: 性能目标
在典型大批量场景下，实例化路径 MUST 显著优于逐对象绘制。

#### Scenario: 30000 飘字对象
- **WHEN** 同屏渲染 30000 个飘字实例
- **THEN** drawcall 由约 30000 降至个位数，且移动端帧率 ≥ 55 FPS
