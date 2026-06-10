## 1. 调研与基线

- [x] 1.1 确认改动入口：`engine/cocos2d/renderer/gfx/device.js`（上下文 611-614、扩展/实例化 641-662、caps 719、绘制 1390-1402），并跑通引擎构建（gulp）→ 产物生效的链路
- [x] 1.2 记录现状基线：WebGL1 下目标场景的 drawcall 数与帧率，作为对比基准
- [x] 1.3 确认 shader 在 WebGL2 上下文下可正常编译（保持 GLSL 1.0）

## 2. 引擎 WebGL2 上下文支持

- [x] 2.1 设备初始化优先 `getContext('webgl2')`，失败回退 WebGL1
- [x] 2.2 新增 `device.webgl2` 标记并暴露给上层
- [x] 2.3 WebGL2 模式跳过 `ANGLE_instanced_arrays`，统一绑定原生 `vertexAttribDivisor`/`drawArraysInstanced`/`drawElementsInstanced`
- [x] 2.4 正确设置 `caps.supportInstancing`（WebGL2 恒 true）、MRT caps 走核心参数

## 3. WebGL2 原生实例化路径

- [x] 3.1 复用引擎带 divisor=1 顶点流 + `attrsDirty` 门控路径（经评审不引入 VAO）
- [x] 3.2 确认 `InstanceBatchRenderer` 在 WebGL2 下无需改动即可走原生实例化（API 不变）
- [x] 3.3 保持 `upload(data, count)` 等对外 API 不变，复用 Float32Array 与 2 倍扩容，确认每帧零 GC

## 4. 兜底与兼容

- [x] 4.1 WebGL1 + ANGLE 路径回归，确认与 WebGL2 路径渲染一致（需 Creator 运行时）
- [x] 4.2 提供强制 WebGL1 的开关 `Device.forceWebGL1`，便于对比与回滚

## 5. 验证

- [x] 5.1 既有场景在 WebGL2 下逐帧对比，无渲染差异与报错
- [x] 5.2 30000 飘字实例场景：验证 drawcall 降至个位数、移动端帧率 ≥ 55 FPS
- [x] 5.3 在 WebGL1（强制回退）与 WebGL2 双环境完成回归
- [x] 5.4 运行 `openspec validate webgl2-instanced-rendering --strict` 通过
