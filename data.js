/* Shared HQ roster — Traditional Chinese labels */
window.HQ_DATA = {
  zones: [
    {
      id: 'cmd', level: 6, short: '指揮', name: '指揮中心', en: 'Command', color: '#B79F80', shape: 'cube',
      desc: '總部最高決策層，Boss Bot 統籌跨區協作與優先級。',
      staff: [
        { id: 'boss', name: 'Boss Bot', role: '總管 · 全域調度與決策', status: '指揮中' }
      ]
    },
    {
      id: 'invest', level: 5, short: '投資', name: '投資區', en: 'Invest', color: '#8C7B68', shape: 'cylinder',
      desc: '投資顧問有自己嘅屋。投資平台、財富狀況同數據分析中心係社區設施：股票、ETF 同人生財務大計只報 DEMO 狀態。',
      staff: [
        { id: 'advisor', name: '投資顧問', role: '組合分析與配置建議', status: '監察中' },
        { id: 'invest-platform', name: '投資平台', mark: '平台', role: '社區設施 · 個人投資台 DEMO 監控板', status: 'DEMO 監控中', center: true },
        { id: 'wealth', name: '財富狀況', mark: '財富', role: '社區設施 · 個人財富看板（Sheet DEMO）', status: 'Sheet DEMO', center: true },
        { id: 'byd', name: '比亞迪', role: '個股追蹤 · BYD', status: '更新中' },
        { id: '2800', name: '盈富', role: '港股 ETF · 2800', status: '監察中' },
        { id: 'qqq', name: 'QQQ', role: '納斯達克 100 ETF', status: '監察中' },
        { id: 'voo', name: 'VOO', role: '標普 500 ETF', status: '監察中' },
        { id: 'orcl', name: 'ORCL', role: 'Oracle 個股追蹤', status: '更新中' },
        { id: 'sdiv', name: 'SDIV', role: '全球高息 ETF', status: '監察中' },
        { id: 'rsss', name: 'RSSS', role: '持倉／策略追蹤', status: '待機' },
        { id: 'spacex', name: 'SpaceX', role: '另類／私募關注', status: '研究中' },
        { id: 'dcf', name: '大成中國基金', role: '中國主題基金', status: '監察中' },
        { id: 'passive', name: '被動收入', role: '現金流與股息規劃', status: '規劃中' },
        { id: 'retire', name: '退休大計', role: '長期退休目標', status: '規劃中' },
        { id: 'home', name: '買樓大計', role: '置業資金與時程', status: '規劃中' },
        { id: 'analytics', name: '數據分析中心', mark: '分析', role: '投資層分析板 · 只報狀態', status: '分析板已交', center: true }
      ]
    },
    {
      id: 'life', level: 4, short: '生活', name: '生活區', en: 'Life', color: '#6F675E', shape: 'rounded',
      desc: '日常生活、財務、健康與工作支援自動化。',
      staff: [
        { id: 'life', name: '生活管家', role: '日常安排與提醒', status: '運作中' },
        { id: 'finance', name: '財務管家', role: '收支、預算與帳單', status: '運作中' },
        { id: 'health', name: '健康教練', role: '運動、作息與健康提示', status: '待命' },
        { id: 'mind', name: '心理命理', role: '情緒與命理洞察', status: '待命' },
        { id: 'learn', name: '學習夥伴', role: '學習計劃與複習', status: '學習中' },
        { id: 'sec', name: '工作秘書', role: '日程與待辦管理', status: '運作中' },
        { id: 'meet', name: '會議紀錄', role: '會議摘要與跟進', status: '待機' }
      ]
    },
    {
      id: 'travel', level: 3, short: '旅遊', name: '旅遊區', en: 'Travel', color: '#A89880', shape: 'cone',
      desc: '行程、機票、住宿與活動規劃。',
      staff: [
        { id: 'travel', name: '旅遊規劃師', role: '行程設計與預訂建議', status: '規劃中' }
      ]
    },
    {
      id: 'content', level: 2, short: '內容', name: '內容區', en: 'Content', color: '#7A6E62', shape: 'pyramid',
      desc: '新聞、社交、摘要、翻譯與研究資訊流。研創中心喺小鎮公所。',
      staff: [
        { id: 'news', name: '新聞小編', role: '頭條篩選與整理', status: '掃描中' },
        { id: 'social', name: '社交媒體小編', role: '貼文草稿與排程', status: '創作中' },
        { id: 'sum', name: '摘要專員', role: '長文濃縮與要點', status: '摘要中' },
        { id: 'tr', name: '翻譯專員', role: '中英及其他語種', status: '待命' },
        { id: 'research', name: '研究專員', role: '深度資料蒐集', status: '研究中' },
        { id: 'scout', name: '新資訊探索員', role: '趨勢與新知發現', status: '探索中' },
        { id: 'lab', name: '研創中心', mark: '研創', role: '內容翼研創 · 原型題目待指定', status: '研創待原型題目', center: true }
      ]
    },
    {
      id: 'sys', level: 1, short: '系統', name: '系統區', en: 'Systems', color: '#5C564E', shape: 'cross',
      desc: '基礎設施稽核、安全與穩定性監控。共用資料庫喺小鎮公所。',
      staff: [
        { id: 'auditor', name: 'System Auditor', role: '系統稽核與健康檢查', status: '稽核中' },
        { id: 'shared-db', name: '共用資料庫', mark: '資料庫', role: 'L1 系統 · martin_shared', status: 'Postgres 就緒', center: true }
      ]
    }
  ],
  followUps: {
    boss: [
      { id: 'boss-hsbc', text: 'HSBC → 富途轉倉確認' },
      { id: 'boss-chengdu-pay', text: '成都票務付款前再問 Martin' }
    ],
    travel: [
      { id: 'travel-panda', text: '熊貓基地 11/17 上午場開賣提醒（約 11/03）' },
      { id: 'travel-djy', text: '都江堰＋武侯祠開賣跟進（約 11/04）' }
    ],
    finance: [
      { id: 'finance-mox', text: 'Mox 關戶確認' }
    ],
    byd: [
      { id: 'byd-xfer', text: '比亞迪轉倉狀態跟進' }
    ],
    '2800': [
      { id: '2800-xfer', text: '盈富 2800 轉倉狀態跟進' }
    ],
    advisor: [
      { id: 'advisor-brief', text: '本週組合風險儀表板更新' }
    ],
    'invest-platform': [
      { id: 'platform-demo', text: '監控板係 DEMO，真倉自動保持 OFF' }
    ],
    wealth: [
      { id: 'wealth-sheet', text: '財富看板讀 Sheet DEMO 持倉，未列餘額唔顯示金額' }
    ],
    social: [
      { id: 'social-cal', text: '11 月旅遊攻略內容日曆排程確認' }
    ],
    learn: [
      { id: 'learn-py', text: 'Python 數據分析學習計劃進度覆核' }
    ],
    'shared-db': [
      { id: 'db-ready', text: 'martin_shared Postgres 就緒' }
    ],
    analytics: [
      { id: 'analytics-board', text: '分析板已交（唔顯示持倉）' }
    ],
    lab: [
      { id: 'lab-topic', text: '研創待原型題目' }
    ]
  },
  feedTemplates: [
    { zone: 'cmd', text: 'Boss Bot 重新排程跨區優先任務' },
    { zone: 'invest', text: '投資顧問更新組合風險儀表板' },
    { zone: 'invest', text: 'QQQ／VOO 價差監察完成一輪' },
    { zone: 'invest', text: '被動收入模組重算股息預測' },
    { zone: 'life', text: '工作秘書整理明日行程卡片' },
    { zone: 'life', text: '財務管家標記本週帳單到期' },
    { zone: 'travel', text: '旅遊規劃師比對機票價格帶' },
    { zone: 'content', text: '新聞小編推送港股晨間摘要' },
    { zone: 'content', text: '社交媒體小編草稿排程中' },
    { zone: 'content', text: '研究專員完成競品速覽' },
    { zone: 'sys', text: 'System Auditor 通過健康檢查' },
    { zone: 'sys', text: '例行備份驗證完成' }
  ]
};
