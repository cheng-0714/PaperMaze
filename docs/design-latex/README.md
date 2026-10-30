# PaperMaze 纸境寻路实验室

PaperMaze 是一个面向数据结构课程综合实践的迷宫生成与寻路可视化系统。用户可以手动走迷宫、编辑墙体与起终点，观察 BFS 和 A* 的访问顺序与最终路径，并将每次实验保存在本地 SQLite 数据库中。

## 主要功能

- 欧式版画风格的三幕纸上旅程：雾港残卷、荆棘修道院、孤崖圣所。场景切换对应 DFS、Prim、Kruskal 生成策略，手动抵达终点后可继续下一幕。
- 旧纸、钴蓝蚀刻迷宫和独立场景插画；探索、寻路、逐步讲解集中切换，实验数据收在下方寻路手记。

- 按 11×11、21×21、31×31、41×41、51×51 和随机种子生成可复现迷宫
- 键盘、WASD 或屏幕方向键手动探索
- BFS 与 A* 搜索、指标对比、暂停/重放，滑条以 0.5× 步进调节 0.5×–5×回放速度
- 生成器实验台：可视化 DFS 回溯、随机 Prim 和 Kruskal 并查集的逐步过程，比较逻辑单元、打通边、连通分量与环秩
- BFS/A* 算法教学模式：显示队列或优先队列、当前节点、父指针、A* 的 g/h/f，并支持单步前进、后退、暂停和继续
- 迷宫结构体检与终点距离热力图；BFS/A* 在同一地图上叠加访问区域和路径
- 按需生成 AI 解读；配置 `DEEPSEEK_API_KEY` 使用 DeepSeek，未配置时自动使用本地规则解释
- 墙体、通路、起点和终点编辑，支持无解迷宫
- 挑战码复现同一生成迷宫；旧版 `PM1-尺寸-种子` 保持兼容，Prim/Kruskal 使用包含生成器身份的 `PM2-算法-尺寸-种子`

## 启动

准备 Windows、Python 3.11 或更高版本、Node.js 20.19.x 或 22.12 及以上版本、pnpm，以及 Chrome 或 Edge。首次启动需要联网安装前后端依赖。打开项目根目录，在 PowerShell 中运行：

```powershell
.\start.ps1
```

脚本会安装依赖、构建前端并在 `http://127.0.0.1:8000` 启动应用。启动后在浏览器访问该地址；终端保持运行，按 `Ctrl+C` 停止服务。历史记录默认保存在项目根目录的 `papermaze.sqlite3`；该文件是本机数据，不随源码提交。

开发时先创建虚拟环境并安装后端依赖，然后分别启动两个终端：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt

# 终端 1，项目根目录
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload

# 终端 2，项目根目录
cd frontend
pnpm install
pnpm dev
```

开发模式请访问 Vite 在终端输出的地址，接口请求会转发到后端。

## 操作与验收

1. 点击“密匙”，设置地图尺寸和种子，点击“绘制舆图”；“重布石阵”可生成新地图。
2. 选择“手持火把”，点击迷宫并使用方向键或 WASD，或使用屏幕方向按钮。遇到墙体或边界时角色不会移动。
3. 使用“始门”“终门”选择通路格，设置起点和终点；“立石”“凿空”用于编辑墙体和通路。起终点不可重合，也不能放在墙上。
4. 选择“算法寻路”，分别运行 BFS 和 A*；地图展示搜索与路径，下方“寻路手记”显示路径长度、访问节点及计算耗时。播放控制和倍速不会计入算法耗时。
5. 将目标所在通路与起点隔断后运行寻路，系统会提示无解。手动到达终点或完成一次搜索后会保存运行；刷新后点击“足迹”和“重访”，可恢复当时的完整地图和结果。

挑战码只复现生成时的地图，编辑后的墙体与起终点应通过保存后的“足迹”恢复。手动尚未到达终点时不保存为完成记录。

在四方向、单位代价的地图中，BFS 与 A* 均可用于寻找最短路径。A* 会更新候选节点的更短路径；带环地图的回归用例和验收情况见 [docs/验收核查.md](docs/验收核查.md)。

## 测试

```powershell
cd frontend
pnpm test
pnpm typecheck
pnpm build

cd ..
.\.venv\Scripts\python.exe -m pytest backend\tests -q
```

架构、测试范围和演示验收步骤见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、[docs/TESTING.md](docs/TESTING.md) 与 [docs/ACCEPTANCE_CHECKLIST.md](docs/ACCEPTANCE_CHECKLIST.md)。

## AI 辅助开发与运行时解读

开发过程中使用 Codex 辅助需求梳理、架构设计、代码实现、测试和前端改版；项目使用者对需求和方案进行选择，并通过测试、构建和浏览器检查验证结果。具体使用范围见 [docs/AI_USAGE.md](docs/AI_USAGE.md)，提交材料另附真实对话摘录。

AI 解读接口只在服务端读取 `DEEPSEEK_API_KEY`，不会把密钥发送到浏览器。默认使用 `deepseek-flash`、非流式请求和 8 秒超时；没有密钥或上游异常时，系统会返回同一份指标的本地解释，迷宫和寻路功能不受影响。
