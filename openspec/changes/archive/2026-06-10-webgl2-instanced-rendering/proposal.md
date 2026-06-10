## Why

引擎当前只创建 WebGL1 上下文（`getContext('webgl')`），实例化依赖 `ANGLE_instanced_arrays` 扩展，存在扩展缺失风险，且无法使用 WebGL2 的 VAO、整型属性、UBO 等能力。升级到 WebGL2 可让实例化成为原生能力，提升大批量同构对象（GPUInstance、飘字）的渲染效率与稳定性。

## What Changes

- 引擎 GFX 设备优先创建 WebGL2 上下文，失败时自动回退 WebGL1 + ANGLE（不破坏现有项目）。
- 暴露 `device.webgl2` / `caps.supportInstancing` 能力查询，供上层选择渲染路径。
- 实例化渲染改用 WebGL2 原生 `vertexAttribDivisor` / `drawArraysInstanced` / `drawElementsInstanced`，并接入 VAO 管理实例属性流。
- `InstanceBatchRenderer` 适配双路径（WebGL2 原生 / WebGL1 ANGLE），对外 API 不变。

## Capabilities

### New Capabilities
- `webgl2-context`: 引擎在 WebGL2 优先、WebGL1 兜底策略下创建与管理渲染上下文，并暴露能力查询。
- `webgl2-instancing`: 基于 WebGL2 原生实例化 API 的实例化渲染路径，含 VAO 与实例属性流管理。

### Modified Capabilities
<!-- 暂无已归档 spec，无需修改既有能力 -->

## Impact

- **引擎**：`engine` GFX `device.js`（上下文创建、扩展初始化、能力位）。
- **业务代码**：`assets/Script/Core/GpuInstance/InstanceBatchRenderer.ts`、相关 Effect/Material（shader 可保持 GLSL 1.0，WebGL2 兼容）。
- **drawcall / 内存**：N 个同构实例由 N 次 drawcall 降为 1 次；新增 1 份实例属性 VBO（容量按 2 倍扩容），内存随实例数线性增长、整体可控。
- **风险**：修改引擎源码影响全局渲染，需在 WebGL1/WebGL2 双环境回归。
