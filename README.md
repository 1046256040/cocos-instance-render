# NewProject — 高性能 2D 渲染示例

基于 **CocosCreator 2.4.15**（cocos2d-html5）的高性能 2D 渲染实验项目，聚焦自定义底层渲染、GPU 实例化，以及大批量飘字（伤害数字）系统，并扩展引擎支持 **WebGL2**。

## 特性

- **GLRender**：基于 `cc.RenderComponent` 的自定义渲染组件，直接组织顶点数据，绕过部分内置开销。
- **GPUInstance**：GPU 实例化渲染，同形不同参对象以单次 drawcall 批量绘制，与 GLRender 做性能对比。
- **高性能飘字（FlowText）**：基于实例化的伤害数字/飘字系统，支持字形图集、动画预设、数量上限控制。
- **WebGL2 支持**：引擎优先创建 WebGL2 上下文并使用原生实例化 API，自动回退 WebGL1 + ANGLE。

## 环境要求

- CocosCreator **2.4.15**
- 自定义引擎：项目已通过 `local/settings.json` 指向仓库内的 `engine/`（`js-engine-path`）。首次打开或修改引擎源码后，需在编辑器中重新编译自定义引擎才能生效。

## 目录结构

| 路径 | 说明 |
|------|------|
| `assets/Script/Core/GLRender/` | GLRender 渲染组件、Assembler、GLNode 等核心实现 |
| `assets/Script/Core/GpuInstance/` | `InstanceBatchRenderer` 实例化批渲染器 |
| `assets/Script/FlowText/` | 飘字系统：`FlowTextAPI`（组件入口）、`FlowTextCore`（数据与动画）|
| `assets/Script/FoodTest/` | 性能对比测试场景脚本（GLRenderTest / GpuInstanceTest）|
| `assets/Effect/` `assets/Material/` | 自定义 shader 与材质 |
| `assets/Scene/` `assets/Texture/` | 场景与贴图资源 |
| `engine/` | 自定义 Cocos 引擎源码（含 WebGL2 改动）|
| `doc/webgl-rendering-notes.md` | WebGL 渲染原理与 GLRender / GPUInstance 差异详解 |
| `openspec/` | 规范驱动开发（specs / changes）|

## WebGL2 与实例化渲染

引擎渲染设备 [`engine/cocos2d/renderer/gfx/device.js`](engine/cocos2d/renderer/gfx/device.js) 的关键行为：

- **上下文创建**：优先 `getContext('webgl2')`，失败回退 WebGL1 + ANGLE。
- **能力查询**：`cc.renderer.device.webgl2`（是否 WebGL2）、`cc.renderer.device.caps.supportInstancing`（WebGL2 恒为 `true`）。
- **实例化**：WebGL2 下直接使用原生 `vertexAttribDivisor` / `drawArraysInstanced` / `drawElementsInstanced`，无需扩展。
- **强制回退**：设置 `Device.forceWebGL1 = true` 可强制走 WebGL1 路径，便于对比与回滚。

实例化数据通过 `InstanceBatchRenderer` 上传：使用 divisor=1 的独立顶点流传递每实例属性，按 2 倍策略扩容并复用 `Float32Array`，稳态无每帧 GC。上层（含飘字）无需感知 WebGL1/WebGL2 差异。

### 控制台快速自检

在运行时控制台执行，确认渲染路径与实例化能力：

```js
const d = cc.renderer.device;
console.log('webgl2 =', d.webgl2, '| supportInstancing =', d.caps.supportInstancing);
```

## 飘字（FlowText）用法

`FlowTextAPI` 是挂载在节点上的组件，需在编辑器配置字形图集、Effect/材质等属性。运行时 API：

```ts
// 显示一段文本 / 一个数字（如伤害值）
flowText.showText(position, "Miss");
flowText.showNumber(position, 1024);

// 控制
flowText.setLimit(2000);          // 同屏飘字数量上限
flowText.hideText();              // 清除当前飘字
```

> 飘字依赖实例化能力：`FlowTextAPI` 在 `onLoad` 会检查 `device.caps.supportInstancing`，不支持时会降级处理。

## 性能参考

大批量同形对象下，实例化相较逐对象绘制可将 drawcall 从 ~N 降至个位数。目标：移动端 30000 飘字实例 ≥ 55 FPS。详见 [`doc/webgl-rendering-notes.md`](doc/webgl-rendering-notes.md) 中的原理与对比分析。

## 开发约定

- 提交规范：[Conventional Commits](https://www.conventionalcommits.org/)（`feat` / `fix` / `docs` / `refactor` / `perf` ...）。
- 渲染改动需说明对 drawcall / 内存的影响，并兼顾移动端性能。
- 新功能走 OpenSpec 流程：`openspec new change <name>` → 编写 proposal/specs/tasks → 实现 → `openspec archive`。详见 `openspec/`。
