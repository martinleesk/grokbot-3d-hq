# GrokBot 卡通小鎮

Martin Lee 嘅即時總部。主畫面係一張暖色卡通小鎮，唔再係六層高塔。

The live HQ is a warm cartoon town. The stacked tower is no longer the primary view.

## 點樣用 / How to look around

- 打開 `index.html`（GitHub Pages 直接伺服呢個靜態網站，唔使 build）。
- 全景係小鎮：北邊公所係 **共用資料庫**、**數據分析中心**、**研創中心**，同埋大家一齊開工嘅 **會議廳**。
- 八間屋：Boss Bot、工作秘書、財務管家、投資顧問、生活管家、旅遊規劃師、新聞小編、System Auditor。屋主企喺門口。
- 其餘同事企喺相關屋前或公所崗位（分析台、投資後院、生活屋前、新聞後院、研創前地），唔再預設泊喺巷口。投資街／生活巷／內容巷只係偶爾行過去對一對。
- 右上角 **而家做緊** 列出每人而家做緊咩（跟 live.json 焦點或狀態）。拉近啲會見到頭上短標同對話泡。
- 大約每半分鐘會見到一對鄰位同事行埋一齊講兩句，另有人巡屋或者交低進度。開會嗰陣相關同事會聚喺會議廳門口。
- **點一個人**（或左側名單）進入室內。牆上手牌同底下說明寫明姿勢同依據。室內姿勢仍然只跟 live.json：坐、待命、短走、開會。
- **返回小鎮** 或頂欄 **全景** 走返出地圖。拖曳旋轉，滾輪拉近。
- **晝 / 金** 係日間同黃金時刻。
- 如果部機冇 WebGL，會留喺同一張平面小鎮，點屋一樣開室內卡。

Open the static site (GitHub Pages serves this folder; there is no build). The north green is the shared civic block: database, analytics, lab, and the meeting hall. Eight houses are built for core staff; everyone else stands at a related porch or civic desk, not in the side lanes. The **而家做緊** list (top right) shows each person's current work from `live.json`. Click a person to step inside. The wall card states the pose and which `live.json` field it came from. **全景** or **返回小鎮** steps back outside. **晝 / 金** switches daylight and golden hour.

## live.json 點樣驅動室內 / What drives the room

`live.json` 嘅現有欄位唔使改，朝早 LIVE 推送照舊。小鎮只係讀，唔會要求新欄。

The shipped `live.json` shape is unchanged. Morning brief pushes keep working. The town only reads it.

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

`node town.test.js` checks the morning brief, workplace posts (not lane parking), activity labels, and that outdoor chats stay tied to real status text. At 08:10 HKT people are at their desks or idle, at 12:00 the secretary is in the DOM block, and at 20:00 Boss is out for a private plan rather than typing at a desk.
