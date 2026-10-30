你在 C:\project\PaperMaze 项目中工作（Windows, PowerShell）。请完成以下 5 项修改。所有内容必须依据仓库中的真实代码与文档（frontend/src、backend、README.md、docs/ARCHITECTURE.md），不得编造不存在的模块、功能或文件。报告：docs\design-latex\main.tex（已备份为 main.tex.bak-20261030，不要动备份），图片放在 docs\design-latex\images。口播稿：docs\design-latex\demo_script_final.md。

1. 重画“总体架构”一节（第 143 行附近“分层与数据流”）中的架构图：当前是一堆文字加箭头。先阅读 frontend/src、backend、docs/ARCHITECTURE.md 核对真实结构，然后用 TikZ（\usepackage{tikz}，\usetikzlibrary{positioning,arrows.meta,fit,backgrounds}）画真正的分层架构图，用分层方框加箭头：
   - 前端表现层：Vue 交互界面（场景、操作、回放、教学游标、SVG 地图）——请用代码中真实组件/文件名标注
   - 前端领域层：迷宫生成（DFS、Prim、Kruskal）、移动与编辑、BFS 与 A* 寻路、结构分析（对应 frontend/src/core 中真实文件）
   - 通过 JSON/HTTP 连接 FastAPI 后端：校验、AI 解读（DeepSeek + 本地兜底）——如代码里确实如此
   - SQLite 完整运行快照
   只画代码中真实存在的东西。图宽不超过 \textwidth，放在 figure 环境里并加 caption。
2. 图“编辑地图后的无解提示”（images/04-无解提示.png）截图不完整，只剩一条横条。在正在运行的应用 http://127.0.0.1:8000 中重新截一张完整截图：用墙把终点封住、运行 BFS、显示无解提示，然后覆盖替换 images/04-无解提示.png。可以用 Playwright（如可用）或无头 Edge（C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe）通过 CDP/脚本驱动。视口用 1920x1080、deviceScaleFactor 2，截完整页面。截图脚本放在 docs\design-latex\scripts\ 下保留。必须真实操作复现出该状态（不要伪造 DOM）。完成后确认截图里能看到被墙封住的终点和无解提示文字。
3. 新增一节“设计理念”（放在“需求分析”之后、“总体架构”之前，或你认为合适的靠前位置）：我们用欧洲奇幻风格的故事背景（三幕纸上旅程：雾港残卷、荆棘修道院、孤崖圣所，分别对应 DFS、Prim、Kruskal 三种生成方式；旧纸、钴蓝蚀刻版画风）和前端风格，引导用户在探索故事的过程中完成算法学习：先自己走迷宫，再看 BFS 和 A* 寻路，再单步拆开看。请以 README 和代码（如 App.vue、PaperLayers.vue、style.css）为依据，只写真实存在的内容，名称以代码为准。
4. 在报告靠前位置（“项目概述与目标”之后、深入设计之前）加一张完整的整体主页面截图（全屏、高清，1920x1080 视口，deviceScaleFactor 2，截完整主页面），保存为 images/00-整体页面.png，并在报告中加入 figure 和简要说明，让审阅者先看到成品样子。
5. 修改口播稿 docs\design-latex\demo_script_final.md：在开场或产品介绍那段写入设计理念，讲清楚奇幻故事背景是用来引导学习的。总字数控制在 1000 字左右以内（可适当精简其他口语句子），所有画面提示和按钮名保持原样不变。UTF-8 编码保存。

完成后用 XeLaTeX 编译（C:\texlive\2026\bin\windows\xelatex.exe，在 docs\design-latex 下运行两次 xelatex -interaction=nonstopmode main.tex），修复错误和 overfull 问题。最后简要列出你改了什么、新增了哪些文件。
