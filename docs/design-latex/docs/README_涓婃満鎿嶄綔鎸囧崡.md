# 四路多路选择器 Vivado 上机操作指南

本指南面向只熟悉 Vivado 基本操作的使用者。实验材料目录为 `Lab1_MUX4_Experiment`，设计顶层是 `mux4_1`，仿真顶层是 `mux4_1_tb`。

## 阶段 A：解压与创建项目

1. 从 U 盘复制 `Lab1_MUX4_Experiment.zip` 到 Windows 本地目录。
2. 使用资源管理器解压 ZIP。建议解压到不含空格和特殊权限限制的本地目录。
3. 启动 Vivado，选择 **Create Project**。
4. 在 **New Project Wizard** 中选择工程名称和位置，勾选 **RTL Project**，然后进入器件选择页面。
5. 根据目标开发板或实验电脑可用器件选择正确的 FPGA Part Number。本实验不要求上板，因此不需要导入原加法器的 `.xdc` 约束文件。
6. 在 **Add Sources** 页面添加 `rtl/mux4_1.v`，将其加入 **Design Sources**。
7. 在 **Add or Create Simulation Sources** 页面添加 `sim/mux4_1_tb.v`，将其加入 **Simulation Sources**。
8. 完成工程创建后，在左侧 **Sources** 窗格中右键 `mux4_1`，选择 **Set as Top**。Design Sources 顶层必须是 `mux4_1`。
9. 展开 **Simulation Sources**，右键 `mux4_1_tb`，选择 **Set as Top**。仿真顶层必须是 `mux4_1_tb`。
10. 不要把 Testbench 放入 Design Sources，也不要加入 `adder.v`、`adder_display.v`、`adder.xdc` 或 `lcd_module.dcp`。

### 可选的 Tcl 创建方式

如果已经知道目标器件的 Part Number，可以在实验目录的上一级打开 Vivado Tcl Shell，执行：

```text
vivado -mode tcl -source Lab1_MUX4_Experiment/vivado/create_project.tcl -tclargs <FPGA-Part-Number>
```

例如器件确实为 `xc7a35tcpg236-1` 时才使用该参数：

```text
vivado -mode tcl -source Lab1_MUX4_Experiment/vivado/create_project.tcl -tclargs xc7a35tcpg236-1
```

脚本会在材料目录下创建 `vivado_project`，并自动设置 Design Top 和 Simulation Top。它发现同名目录已存在时会停止，不会覆盖原工程。若不确定 Part Number，请使用 GUI 创建工程。

## 阶段 B：运行四组功能仿真

1. 确认 Sources 窗格中 `mux4_1.v` 属于 Design Sources，`mux4_1_tb.v` 属于 Simulation Sources。
2. 在左侧 **Flow Navigator** 中展开 **Simulation**，点击 **Run Simulation -> Run Behavioral Simulation**。
3. 等待仿真窗口打开。若信号列表为空，在 **Scopes** 中选中 `mux4_1_tb`，再在 **Objects** 中选择所需信号并右键 **Add to Wave Window**。
4. 必须将以下六个信号加入波形窗口：`in0`、`in1`、`in2`、`in3`、`sel`、`out`。
5. 右键各数据总线，选择 **Radix -> Hexadecimal**。`sel` 也建议设置为 Hexadecimal 或 Binary，报告中按照 `00`、`01`、`10`、`11` 读取。
6. 在仿真 Tcl Console 中可以执行 `run 80 ns`；Testbench 也会在 80 ns 自动 `$finish`。如果窗口已自动运行到结束，直接调整时间轴即可。
7. 使用 **Zoom Fit**，或拖动时间轴，使 0-80 ns 四个完整区间同时可见。
8. 逐项核对：0-20 ns 输出 `11111111`，20-40 ns 输出 `22222222`，40-60 ns 输出 `33333333`，60-80 ns 输出 `44444444`。
9. 在仿真 Console 中查看 `PASS` 行。四组均正确时应出现 `ALL TESTS PASSED`；出现 `FAIL` 时先检查顶层、文件归属和波形中的端口连接。
10. 调整波形区域宽度，使信号名称、十六进制值和时间轴清晰可读，截取完整 Vivado 窗口，保存为 `screenshots/mux4_1_waveform.png`。

## 阶段 C：生成 RTL 原理图

1. 关闭或保留仿真窗口均可，回到 Vivado 主窗口。
2. 在左侧 **Flow Navigator** 选择 **RTL Analysis -> Open Elaborated Design**。
3. 确认 Elaborated Design 的顶层为 `mux4_1`，不要选择 `mux4_1_tb`。
4. 在设计窗口打开 **Schematic**。
5. 如果只看到一个模块外框，双击 `mux4_1` 或使用右键菜单展开层次结构。
6. 使用 **Zoom Fit** 和缩放工具，让四路数据输入、2 位 `sel`、组合选择逻辑和 32 位输出可读。
7. 必要时拖动模块和端口，避免信号名重叠。
8. 截取包含 Vivado 标题栏和 Schematic 视图的图片，保存为 `screenshots/mux4_1_schematic.png`。

更具体的原理图操作和结果表述边界见 `docs/Vivado原理图操作说明.md`。

## 阶段 D：完成实验报告

1. 将 `rtl/mux4_1.v`、`sim/mux4_1_tb.v` 和 `docs/实验报告新增章节.md` 与原实验报告材料放在一起。
2. 将真实波形图片插入 `四路多路选择器的设计与仿真` 章节的波形图占位处。
3. 将真实 RTL 原理图插入同一章节的原理图占位处。
4. 按原报告已有图号顺序替换 `图 X`，不要重复已有图号。
5. 对照波形核对四组输出值和时间区间，确认报告代码与源文件一致。
6. 统一章节编号、字体、代码等宽字体、表题和图题后导出最终 PDF。

## 常见问题排查

### 仿真顶层设置错误

如果 Vivado 将 `mux4_1` 当作仿真顶层，仿真窗口不会执行激励。请在 **Simulation Sources** 中右键 `mux4_1_tb`，选择 **Set as Top**，再重新运行 Behavioral Simulation。

### 波形没有显示

仿真窗口中必须先在 **Scopes** 选中 `mux4_1_tb`，再从 **Objects** 选择信号并执行 **Add to Wave Window**。若窗口仍为空，重新启动 Behavioral Simulation。

### 仿真时间过短

Testbench 在 80 ns 结束。使用 Tcl Console 执行 `run 80 ns`，然后用 **Zoom Fit** 显示完整范围。不要只截取 0-20 ns 的局部图。

### `sel` 和 `out` 显示格式不便阅读

在波形中右键信号，选择 **Radix -> Hexadecimal**。`sel` 的四种状态可按十六进制 `0`、`1`、`2`、`3` 读取，或改成 Binary 查看 `00`、`01`、`10`、`11`。

### Schematic 只显示模块外框

这通常表示层次尚未展开。双击 `mux4_1`，或在模块上右键选择展开层次结构，再使用 **Zoom Fit**。RTL 视图显示的是展开后的 RTL 结构，不需要打开门级网表。

### Vivado 无法识别源文件

确认文件扩展名是 `.v`，没有被资源管理器隐藏成 `.v.txt`；确认 `mux4_1.v` 在 Design Sources、`mux4_1_tb.v` 在 Simulation Sources；然后在 Sources 窗格右键对应文件选择 **Refresh Hierarchy**。检查模块名与顶层设置完全一致。

## 最终带回检查

- `screenshots/mux4_1_waveform.png`
- `screenshots/mux4_1_schematic.png`
- 已核对的实验报告 PDF
- 若报告仍需后续排版，保留本目录中的 Markdown 章节和源代码
