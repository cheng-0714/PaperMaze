import type { GeneratorAlgorithm } from "./core/generator";

export const scenes: ReadonlyArray<{
  id: string;
  title: string;
  english: string;
  place: string;
  story: string;
  discovery: string;
  ending: string;
  algorithm: GeneratorAlgorithm;
  artwork: string;
}> = [
  {
    id: "harbour",
    title: "雾港残卷",
    english: "The mist-veiled haven",
    place: "THE FOGBOUND SHORE",
    story: "一枚带残损火漆的羊皮古卷，将你引至荒废已久的浪蚀石港。石板路被退潮的海水浸得发黑，前方旧哨塔下，藏着通向修道院的暗门。",
    discovery: "唤起广度优先之术（BFS）：探查如水波均匀漫开，一层探尽方入下一阶，绝不遗漏近处缝隙，所踏出的必是最短之途。",
    ending: "羊皮纸在海风中沙沙翻卷。机括沉闷地咬合，潮声深处，通往古老月桂石庭的玄关无声滑开。",
    algorithm: "dfs",
    artwork: "/art/harbour.webp",
  },
  {
    id: "garden",
    title: "荆棘修道院",
    english: "The cloister labyrinth",
    place: "THE CLOISTER OF LAURELS",
    story: "跨过残破的石拱，脚步声没入幽深的月桂树篱。高耸的灌木遮蔽了月色，岔路繁如蛛网，盲目摸索只会在死胡同里耗尽火把。",
    discovery: "启封星芒测算之法（A*）：靴底实走的步数记作 g，远方钟楼的直线星位化作 h。两数相加择其最优，箭步直指圣所。",
    ending: "拨开垂落的枯藤与刺丛，隐蔽石阶盘旋直指峭壁。上方荒废的大神殿，已在夜幕中露出残缺的穹顶。",
    algorithm: "prim",
    artwork: "/art/garden.webp",
  },
  {
    id: "temple",
    title: "孤崖圣所",
    english: "The high sanctuary",
    place: "THE SANCTUARY ABOVE THE SEA",
    story: "最后的石径盘踞在怒涛峭壁之上。海风呼啸如低语，旧日修士布下的终局巨阵横亘在殿前，等待通晓两门秘术的行者叩门。",
    discovery: "在此摆开双法印证：看 BFS 的层叠潮涌与 A* 的锐利星芒同图对勘，一窥水银泻地与直趋目标的抉择之异。",
    ending: "圣殿铜门沉重开启，风暴被隔绝于身后。石台上的残卷翻至末页：‘迷阵已破。记住照亮你脚步的每一道刻痕。’",
    algorithm: "kruskal",
    artwork: "/art/temple.webp",
  },
];
