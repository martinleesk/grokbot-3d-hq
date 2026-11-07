# GrokBot 卡通小鎮

Martin Lee 嘅即時總部。主畫面係一張暖色卡通小鎮，唔再係六層高塔。

The live HQ is a warm cartoon town. The stacked tower is no longer the primary view.

## 點樣用 / How to look around

- 打開 `index.html`（GitHub Pages 直接伺服呢個靜態網站，唔使 build）。
- 全景係小鎮：北邊社區設施係 **投資平台**、**財富狀況**、**共用資料庫**、**數據分析中心**、**研創中心**，同埋大家一齊開工嘅 **會議廳**。呢幾座係大型設施，平頂、大過屋，唔會叫「屋」。**財富狀況** 喺研創中心前面嘅草坪，金頂、平頂、大過屋，同藍色投資平台分開。點開會開 [`/wealth/`](wealth/)。
- 八間屋：Boss Bot、工作秘書、財務管家、投資顧問（顧問屋）、生活管家、旅遊規劃師、新聞小編、System Auditor。一代理人一屋，屋主企喺門口。
- 其餘同事企喺相關屋前或設施崗位（分析台、投資後院、生活屋前、新聞後院、研創前地），唔再預設泊喺巷口。投資街／生活巷／內容巷只係偶爾行過去對一對。
- 右上角 **而家做緊** 列出每人而家做緊咩（跟 live.json 焦點或狀態）。拉近啲會見到頭上短標同對話泡。
- 大約每半分鐘會見到一對鄰位同事行埋一齊講兩句，另有人巡屋或者交低進度。開會嗰陣相關同事會聚喺會議廳門口。
- **點一個人**（或左側名單）進入室內。牆上手牌同底下說明寫明姿勢同依據。室內姿勢仍然只跟 live.json：坐、待命、短走、開會。
- **投資平台**、數據分析中心、投資顧問室內，同投資區詳情，有 **進入投資平台**。開獨立奶油頁 [`/invest/`](https://martinleesk.github.io/grokbot-3d-hq/invest/)（新分頁），唔會去 Cursor Canvas。
- **返回小鎮** 或頂欄 **全景** 走返出地圖。拖曳旋轉，滾輪拉近。
- **晝 / 金** 係日間同黃金時刻。
- 如果部機冇 WebGL，會留喺同一張平面小鎮，點屋一樣開室內卡。

Open the static site (GitHub Pages serves this folder; there is no build). The north green is the civic block: the investment platform, the wealth hall, database, analytics, lab, and the meeting hall. Those facilities are larger flat-roofed buildings, not houses. The gold **財富狀況** hall sits on the lawn between the lab and the north path, larger than the houses, and opens [`/wealth/`](wealth/). Eight houses remain, one per core agent, including the advisor's own house. Everyone else stands at a related porch or facility desk, not in the side lanes. The **而家做緊** list (top right) shows each person's current work from `live.json`. Click a person to step inside. The wall card states the pose and which `live.json` field it came from. **全景** or **返回小鎮** steps back outside. **晝 / 金** switches daylight and golden hour.

The monitor board is a standalone cream page at [https://martinleesk.github.io/grokbot-3d-hq/invest/](https://martinleesk.github.io/grokbot-3d-hq/invest/). **投資平台** on the town opens that page. The wealth board is [https://martinleesk.github.io/grokbot-3d-hq/wealth/](https://martinleesk.github.io/grokbot-3d-hq/wealth/). **財富狀況** opens that page.

## live.json 點樣驅動室內 / What drives the room

`live.json` 朝早照舊推送。小鎮只係讀，唔要求新欄先至跑得。投資平台頁係可選：有 `invest.dashboardUrl` 先顯示「進入投資平台」。位址係本站 `/invest/`。如果寫咗 Cursor Canvas 網址，小鎮會改開獨立頁。

Morning brief pushes keep working. The town only reads `live.json` and still runs without the optional blocks below. The monitor link appears only when `invest.dashboardUrl` is set. It points at this site's `/invest/` page. A Cursor Canvas URL is rewritten to that page.

| 你見到 / What you see | 姿勢 / Pose | 依據 / Source |
| --- | --- | --- |
| 坐在書桌處理：焦點標題 | `sit` | `focus` owned by that agent (a focus `staffId` of `invest` is shown on 投資顧問) |
| 待命，或「待命 · 未開始」 | `idle` | status contains 待機 or 待命 |
| 外出：私人行程 | `idle` + 外出 | a focus clock range that is happening now, matched to a calendar row whose `where` is 私人 |
| 正在會議廳：行程名 | `meeting` | a focus clock range happening now, matched to a calendar row whose `where` is 工作, or whose title says 會議 |
| 沿屋前小路短走 | `walk` | only when status says 巡邏／短走／行路, or `live.agents` asks for it |
| 公所牆上手牌 | `sit` | that center's own `status` (共用資料庫 / 數據分析中心 / 研創中心) |
| 會議廳空堂 | — | no one is inside a live window; the board lists `calendar` instead of inventing a meeting |

室外會加一小段有來由嘅走動：鄰位短聊、屋主巡崗位、交低進度，或者行去街巷對一對。呢啲唔會改 `infer()` 嘅姿勢。點入室內，仍然係 live.json 嗰個坐／待命／短走／開會。冇人開會，會議廳就寫「目前沒有進行中的會議」。

Outdoor motion is scheduled and local: a neighbor chat, a short patrol, a desk errand, or a lane visit. It does not change `infer()`. Indoors, the pose is still the live.json one. An empty hall says so.

### 可選延伸 / Optional fields

舊欄仍然有效，唔使加先至跑得。

```json
{
  "agents": {
    "health": { "anim": "walk", "note": "沿屋前小路短走：取水" }
  },
  "campus": {
    "meetings": [
      { "id": "am", "title": "晨會", "targetFloor": "cmd", "staffIds": ["boss", "sec"], "when": "11/6 09:00" }
    ]
  },
  "town": {
    "meetings": [
      { "id": "civic", "title": "公所例會", "staffIds": ["auditor"], "when": "11/6 08:10" }
    ]
  }
}
```

- `agents[id].anim` is `idle`, `walk`, `sit`, or `meeting`. It wins over the schedule. `note` is the indoor headline. `target` is ignored by the town (old floor waypoints still parse and do no harm).
- `campus.meetings` still means “these people are in a meeting”. On the town they sit in the shared hall. `targetFloor` is accepted and not used for a floor. A `when` counts from 10 minutes before until 90 minutes after; omit `when` for a standing meeting.
- `town.meetings` is the same list, namespaced for the town. It overrides a campus title for the same person.

### 投資平台 / Invest platform

獨立頁：<https://martinleesk.github.io/grokbot-3d-hq/invest/>（`invest/index.html`）。標題「個人投資台 · 投資平台」。奶油底、鎖定淺色、鋪滿視窗。主角係紙上 DEMO 本金 US$10,000（`invest/data/stub.json` 嘅 `starting_capital`），現金同已投資排喺旁邊。快照若有 Sheet NAV，以細字「Sheet 參考」顯示。真倉自動 OFF。頁頂 **返回小鎮** 去小鎮根目錄。

`live.invest` 唔使有。有 `dashboardUrl`（https，或者相對 `invest/`）時，投資區詳情、**投資平台**、數據分析中心同投資顧問室內都會顯示「進入投資平台」，開新分頁。平面地圖喺投資平台同顧問屋下面都有一粒。標題用 `dashboardTitle`，冇就用「個人投資台 · 投資平台」。`paper.label` 要寫 **SIMULATED**，呢度唔報真倉價。Canvas 網址唔會開。

`live.invest` is optional. A https `dashboardUrl` — or a relative `invest/` path — shows 「進入投資平台」 on the invest detail, inside **投資平台**, the analytics center, and the advisor's room. The flat map puts the same link on the platform and under the advisor house. The link opens the standalone page in a new tab, not Cursor Canvas. `paper.label` stays **SIMULATED**; this view does not show live prices.

### 財富看板 / Wealth board

獨立頁：[`/wealth/`](https://martinleesk.github.io/grokbot-3d-hq/wealth/)（`wealth/index.html`）。奶油全屏。上半係 **投資 · Sheet DEMO 持倉**。最新 `invest/data/snapshot.json` 如果只係市場報價、冇 NAV／權重，看板用 `wealth/data/sheet-holdings.json`（上次已發布個人快照），並寫明時間。ZA Invest、保誠、強積金同現金如果快照未列，就唔顯示金額。Mox 標已關閉。紙上 US$10,000 另外一格，連結去 [`/invest/`](invest/)，唔會計入 Sheet NAV。

下半係 **收支 · 真實記帳（財務管家）**，讀 [`wealth/data/cashflow.json`](wealth/data/cashflow.json)。金額只係 HKD，而且要係正數；`income`／`expense`／`transfer` 先決定方向。轉帳唔計入淨額。未有匯出就顯示「未有真實流水」，唔會砌示範金額。格式見 `wealth/data/README.md`。

`live.wealth.dashboardUrl` 可選。冇就開相對路徑 `wealth/`。點 **財富狀況** 建築物、社區設施列、頂欄「財富」，或者平面地圖上嗰座金頂設施，都會開新分頁。代理人仍然只得自己嘅屋。

The wealth page is [`/wealth/`](https://martinleesk.github.io/grokbot-3d-hq/wealth/). The top half charts the published Sheet DEMO book. If `invest/data/snapshot.json` is only a market watchlist, the page uses `wealth/data/sheet-holdings.json` and says so. Sleeves missing from that snapshot (ZA Invest, Prudential, MPF, cash) stay unlabeled with amounts. Mox is marked closed. The US$10,000 paper account is a separate card that links to [`/invest/`](invest/) and is not added to Sheet NAV. The lower half is real cashflow from 財務管家 in `wealth/data/cashflow.json`: positive HKD amounts, direction from `type`, transfers excluded from net. Until that file has transactions, the board says 「未有真實流水」 and does not invent figures. Clicking the gold **財富狀況** facility opens the page. Agents still only have houses.

`node town.test.js` checks the morning brief, workplace posts (not lane parking), activity labels, and that outdoor chats stay tied to real status text. At 08:10 HKT people are at their desks or idle, at 12:00 the secretary is in the DOM block, and at 20:00 Boss is out for a private plan rather than typing at a desk.
