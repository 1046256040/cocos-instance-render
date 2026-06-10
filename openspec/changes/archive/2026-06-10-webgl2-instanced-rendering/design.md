# 设计：WebGL2 支持与原生实例化渲染

## 背景与现状

引擎 GFX 设备源码为 `engine/cocos2d/renderer/gfx/device.js`（`engine/bin/.cache/dev/__qc_bundle__.js` 是其编译产物，不直接改）。当前：

- 仅通过 `getContext('webgl' | 'experimental-webgl' | ...)` 创建 WebGL1 上下文（`device.js:611-614`）。
- 实例化能力来自扩展：`_instancingExt = ext('ANGLE_instanced_arrays')`，并据此设置
  `_vertexAttribDivisor` / `_drawArraysInstanced` / `_drawElementsInstanced`（`device.js:641-662`）。
- `_initCaps` 据扩展设置 `_caps.supportInstancing`（`device.js:719`）；实际实例化绘制在 `device.js:1390-1402`。
- 业务侧 `InstanceBatchRenderer` 通过 `gfx.VertexFormat` + 顶点流（divisor）实现实例化上传。

**决策（已确认）**：直接修改引擎源码 `device.js`，改后需经引擎构建流程（gulp）重新生成产物才能在项目中生效。

## 目标

1. 设备优先创建 WebGL2，失败回退 WebGL1 + ANGLE。
2. WebGL2 模式下走原生实例化 API（无需扩展），并用 VAO 管理实例属性流。
3. 对上层（含 `InstanceBatchRenderer`）API 透明，不破坏现有渲染。

## 关键决策

### 1. 上下文创建策略
```
gl = canvas.getContext('webgl2', opts)
if (gl) { device.webgl2 = true }
else    { gl = getContext('webgl', ...); device.webgl2 = false }
```
WebGL2 模式下跳过 ANGLE 实例化扩展初始化；其余扩展（如压缩纹理）按原列表保留，缺失则忽略。

### 2. 实例化函数绑定
- WebGL2：直接取 `gl.vertexAttribDivisor` / `gl.drawArraysInstanced` / `gl.drawElementsInstanced`。
- WebGL1：沿用 `ANGLE_instanced_arrays` 的 `*ANGLE` 方法。
- 统一封装为 `device._vertexAttribDivisor` 等内部句柄，调用点不区分来源。

### 3. 实例属性流（不引入 VAO）
引擎 GFX 绘制路径（`_commitVertexBuffers`）本身不使用 VAO，而是「状态 diff + 按需重设属性指针」：仅当 `attrsDirty`（stream/program/缓冲/divisor 变化）时才 `vertexAttribPointer` + `vertexAttribDivisor`，静态批次不会每帧重设。实例化沿用带 divisor=1 的顶点流即可在 WebGL2 上获得单 drawcall。**经评审决定不引入 VAO**：在该 flat 状态模型上加 VAO 属于核心循环重构，风险高而收益已被 `attrsDirty` 门控覆盖。

### 4. Shader 兼容
保持 GLSL 1.0（`attribute/varying`），WebGL2 向后兼容，无需改写为 `#version 300 es`，降低改动面与风险。

### 5. InstanceBatchRenderer 适配
保留现有 `upload(data, count)` / `setVertexStream` / `setInstanceCount` 接口；内部依据 `device.webgl2` 选择 VAO 路径或现有顶点流路径。实例数据缓冲沿用 2 倍扩容 + Float32Array 复用，保证零每帧 GC。

## 风险与回归

- **风险**：直接改引擎源码影响全局渲染；移动端 WebGL2 支持度与驱动差异。
- **回归**：在 WebGL2 / WebGL1（强制回退）双环境下，对既有场景做逐帧对比与 drawcall 计数。
- **回滚**：保留 WebGL1 路径，必要时通过开关强制 WebGL1。

## 备选方案（未采用）

- 全面改写 shader 为 GLSL ES 3.00：收益有限、改动面大，暂不做。
- 仅升级实例化、不升级上下文：无法获得 VAO/原生 API，达不到目标。
