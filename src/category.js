const categoryMap = {
    'icon_news_other': '商城',
    'icon_news_event': '活動',
    'icon_news_update': '更新',
    'icon_news_maintenance': '維修',
    'icon_news_important': '重要',
    'icon_news_defect': 'BUG',
}

export const categories = Object.values(categoryMap)

export const getCategory = (src) => {
    const icon = src.split('/').at(-1).split('.').at(0)
    return categoryMap[icon] || ''
}

export const componentOptions = [
    { label: '商城', description: '道具、露珠道具、造型裝備、露珠增值等相關內容', value: '商城' },
    { label: '活動', description: '加速機、限時活動、官方直播、社群活動等相關內容', value: '活動' },
    { label: '更新', description: '遊戲內容更新、版本更新、劇情更新、地圖更新等相關內容', value: '更新' },
    { label: '維修', description: '伺服器維修、緊急維修等相關內容', value: '維修' },
    { label: '重要', description: '違規件數、客戶服務、執行環境變更、重要通知等相關內容', value: '重要' },
    { label: 'BUG', description: '遊戲內容錯誤、系統錯誤、操作錯誤等相關內容', value: 'BUG' },
]
