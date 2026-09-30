# PaperMaze 纸境寻路实验室

PaperMaze 是一个面向数据结构课程综合实践的迷宫生成与寻路可视化系统。用户可以手动走迷宫、编辑墙体与起终点，观察 BFS 和 A* 的访问顺序与最终路径，并将每次实验保存在本地 SQLite 数据库中。

## 主要功能

- 按 11×11、21×21、31×31、41×41、51×51 和随机种子生成可复现迷宫
- 键盘、WASD 或屏幕方向键手动探索
- BFS 与 A* 搜索、指标对比、暂停/重放，滑条以 0.5× 步进调节 0.5×–5× 回放速度
- 手动挑战成绩：步数、最短路径、绕路率、耗时、撞墙/越界次数与效率徽章
- 迷宫结构体检与终点距离热力图；BFS/A* 在同一地图上叠加访问区域和路径
- 按需生成 AI 解读；配置 `DEEPSEEK_API_KEY` 使用 DeepSeek，未配置时自动使用本地规则解释
- 墙体、通路、起点和终点编辑，支持无解迷宫
- 挑战码复现同一生成迷宫
- 运行历史筛选、恢复与删除，刷新页面后仍保留

## 启动

Windows PowerShell 中运行：

```powershell
.\start.ps1
```

脚本会安装依赖、构建前端并在 `http://127.0.0.1:8000` 启动应用。开发时可分别运行：

```powershell
# 终端 1
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload

# 终端 2
cd frontend
pnpm install
pnpm dev
```

## 测试

```powershell
cd frontend
pnpm test -- --run
pnpm typecheck
pnpm build

cd ..
.\.venv\Scripts\python.exe -m pytest backend\tests -q
```

架构、测试范围和演示验收步骤见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、[docs/TESTING.md](docs/TESTING.md) 与 [docs/ACCEPTANCE_CHECKLIST.md](docs/ACCEPTANCE_CHECKLIST.md)。

AI 解读接口只在服务端读取 `DEEPSEEK_API_KEY`，不会把密钥发送到浏览器。默认使用 `deepseek-flash`、非流式请求和 8 秒超时；没有密钥或上游异常时，系统会返回同一份指标的本地解释，迷宫和寻路功能不受影响。
