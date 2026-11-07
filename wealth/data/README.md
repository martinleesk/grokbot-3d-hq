# 收支檔 `cashflow.json`

財富看板嘅**收支**只讀呢份檔。投資持倉仍然係 Sheet DEMO（`sheet-holdings.json` 或 `invest/data/snapshot.json`），紙上 DEMO 仍然喺投資平台。三樣唔好混。

財務管家由「個人收入與支出統計分析儀表板」匯出之後，原樣覆蓋 `wealth/data/cashflow.json`。頁面只讀呢份 JSON。`cashflow.csv` 係同一份匯出嘅人讀副本，唔係看板數據源。頁面位址係 [https://martinleesk.github.io/grokbot-3d-hq/wealth/](https://martinleesk.github.io/grokbot-3d-hq/wealth/)，檔案係 [https://martinleesk.github.io/grokbot-3d-hq/wealth/data/cashflow.json](https://martinleesk.github.io/grokbot-3d-hq/wealth/data/cashflow.json)。

而家呢份係 2026-11-07 嘅匯出。之後要改數，用新匯出覆蓋，唔好喺檔入面手改金額。如果 `transactions` 係空陣列，看板顯示「未有真實流水」。

## 欄位

| 欄 | 說明 |
| --- | --- |
| `asOf` | 匯出時間，ISO 8601，時區 `+08:00`。 |
| `currency` | 只接受 `HKD`。唔係 HKD 就唔加總。 |
| `source` | `個人收入與支出統計分析儀表板`。 |
| `sheetId` | 上面嗰張表嘅 id。看板唔會再開第二張投資 Google Sheet。 |
| `accounts` | `{ id, label, kind }`。`kind` 係 `bank`、`card`、`wallet` 或 `other`。 |
| `transactions` | 見下面。冇真實流水就係 `[]`。 |
| `gaps` | 已知未齊嘅結單或未匯出原因。字串，唔好塞金額。 |

每筆流水：

| 欄 | 說明 |
| --- | --- |
| `id` | 穩定、唔重複。 |
| `date` | `YYYY-MM-DD`。 |
| `type` | `income`、`expense` 或 `transfer`。 |
| `category` | 類別。 |
| `description` | 說明。 |
| `accountId` | 對應 `accounts[].id`。 |
| `account` | 戶口顯示名。 |
| `amountHkd` | 正數（可以係 0）。方向只睇 `type`，金額本身唔好寫負數。 |
| `note` | 可省略。 |

淨額 = 收入 − 支出。`transfer` 另外顯示，唔計入淨額，亦唔入類別條。
