# GrokBot 卡通小鎮

Martin Lee 嘅即時總部。主畫面係一張暖色卡通小鎮，唔再係六層高塔。

The live HQ is a warm cartoon town. The stacked tower is no longer the primary view.

## 點樣用 / How to look around

- 打開 `index.html`（GitHub Pages 直接伺服呢個靜態網站，唔使 build）。
- 全景係小鎮：北邊公所係 **共用資料庫**、**數據分析中心**、**研創中心**，同埋大家一齊開工嘅 **會議廳**。
- 八間屋：Boss Bot、工作秘書、財務管家、投資顧問、生活管家、旅遊規劃師、新聞小編、System Auditor。
- 其餘代理人係路牌。點路牌會入「街口小檔」，一樣睇到佢而家做緊咩。
- **點一間屋**（或左側名單）進入室內。牆上手牌同底下說明寫明姿勢同依據。
- **返回小鎮** 或頂欄 **全景** 走返出地圖。拖曳旋轉，滾輪拉近。
- **晝 / 金** 係日間同黃金時刻。
- 如果部機冇 WebGL，會留喺同一張平面小鎮，點屋一樣開室內卡。

Open the static site (GitHub Pages serves this folder; there is no build). The north green is the shared civic block: database, analytics, lab, and the meeting hall. Eight houses are built for the first wave; everyone else is a signpost. Click a house, sign, or civic building to step inside. The wall card states the pose and which `live.json` field it came from. **全景** or **返回小鎮** steps back outside. **晝 / 金** switches daylight and golden hour.

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

代理人唔會為咗畫面自己行來行去。冇人開會，會議廳就寫「目前沒有進行中的會議」。

Agents do not pace the map unless the feed says they are walking. An empty hall says so.

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

`node town.test.js` checks the morning brief: at 08:10 HKT people are at their desks or idle, at 12:00 the secretary is in the DOM block, and at 20:00 Boss is out for a private plan rather than typing at a desk.
