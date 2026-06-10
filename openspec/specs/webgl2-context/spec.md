# webgl2-context Specification

## Purpose
TBD - created by archiving change webgl2-instanced-rendering. Update Purpose after archive.
## Requirements
### Requirement: WebGL2 优先创建渲染上下文
引擎 GFX 设备初始化时 MUST 优先尝试创建 WebGL2 上下文（`getContext('webgl2')`），创建成功后 MUST 将设备标记为 WebGL2 模式。

#### Scenario: 浏览器支持 WebGL2
- **WHEN** 运行环境支持 WebGL2
- **THEN** 引擎创建 WebGL2 上下文，`device.webgl2` 为 `true`，且不再初始化 `ANGLE_instanced_arrays` 扩展

#### Scenario: 浏览器不支持 WebGL2
- **WHEN** `getContext('webgl2')` 返回 null
- **THEN** 引擎回退创建 WebGL1 上下文，`device.webgl2` 为 `false`，并按原逻辑初始化 `ANGLE_instanced_arrays`

### Requirement: 能力查询
引擎 MUST 对外暴露可读取的能力位，供上层选择渲染路径，且在 WebGL1/WebGL2 两种模式下均返回正确值。

#### Scenario: 查询实例化支持
- **WHEN** 上层读取 `device.caps.supportInstancing`
- **THEN** WebGL2 模式恒为 `true`；WebGL1 模式取决于 `ANGLE_instanced_arrays` 是否可用

### Requirement: 向后兼容
WebGL2 升级 MUST NOT 改变现有渲染组件（GLRender、内置 2D 渲染）的可见输出与对外 API。

#### Scenario: 现有场景回归
- **WHEN** 在 WebGL2 模式下运行既有场景
- **THEN** 渲染结果与 WebGL1 模式逐帧一致，无报错、无渲染缺失

