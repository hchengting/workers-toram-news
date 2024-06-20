const latestNews = (db) => {
    // Check if the news exists
    const includes = async (news) => !!(await db.prepare('SELECT * FROM latest_news WHERE link = ?').bind(news.link).first())

    // Batch insert news
    const insert = async (news) => {
        if (!news.length) return
        const stmt = db.prepare('INSERT INTO latest_news (date, title, link, thumbnail, img) VALUES (?, ?, ?, ?, ?)')
        await db.batch(news.map((n) => stmt.bind(n.date, n.title, n.link, n.thumbnail || '', n.img || '')))
    }

    // Keep only the last 10 news
    const deleteOld = async () => await db.prepare('DELETE FROM latest_news WHERE id NOT IN (SELECT id FROM latest_news ORDER BY id DESC LIMIT 10)').run()

    // List all news in descending order
    const list = async () => (await db.prepare('SELECT * FROM latest_news ORDER BY id DESC').all()).results

    return {
        includes,
        insert,
        deleteOld,
        list,
    }
}

const webhooks = (db) => {
    // List all webhooks
    const list = async () => (await db.prepare('SELECT * FROM webhooks').all()).results

    return {
        list,
    }
}

// News that are pending to be sent to webhooks
const pendingNews = (db) => {
    // Batch insert pending news
    const insert = async (pendingNews) => {
        if (!pendingNews.length) return
        const stmt = db.prepare('INSERT INTO pending_news (webhook_id, date, title, link, thumbnail, img) VALUES (?, ?, ?, ?, ?, ?)')
        await db.batch(pendingNews.map((n) => stmt.bind(n.webhookId, n.date, n.title, n.link, n.thumbnail || '', n.img || '')))
    }

    // Get the first pending news
    const getFirst = async () =>
        await db
            .prepare(
                'SELECT pending_news.*, webhooks.url AS webhookUrl FROM pending_news JOIN webhooks ON pending_news.webhook_id = webhooks.id ORDER BY pending_news.id ASC LIMIT 1'
            )
            .first()

    // Delete the first pending news
    const deleteFirst = async () => await db.prepare('DELETE FROM pending_news WHERE id = (SELECT id FROM pending_news ORDER BY id ASC LIMIT 1)').run()

    return {
        insert,
        getFirst,
        deleteFirst,
    }
}

const query = {
    latestNews,
    webhooks,
    pendingNews,
}

export default query
