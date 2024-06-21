const latestNews = (db) => {
    // Check if the news exists
    const includes = async (news) => !!(await db.prepare('SELECT * FROM latest_news WHERE link = ?').bind(news.link).first())

    // Batch insert news and keep only the last 10 news
    const insert = async (news) => {
        if (!news.length) return
        const stmti = db.prepare('INSERT INTO latest_news (date, title, link, thumbnail, img) VALUES (?, ?, ?, ?, ?)')
        const stmtd = db.prepare('DELETE FROM latest_news WHERE id NOT IN (SELECT id FROM latest_news ORDER BY id DESC LIMIT 10)')
        await db.batch([...news.map((n) => stmti.bind(n.date, n.title, n.link, n.thumbnail || '', n.img || '')), stmtd])
    }

    // List all news
    const list = async () => (await db.prepare('SELECT * FROM latest_news ORDER BY id ASC').all()).results

    return {
        includes,
        insert,
        list,
    }
}

const webhooks = (db) => {
    // List all webhooks
    const list = async () => (await db.prepare('SELECT * FROM webhooks ORDER BY id ASC').all()).results

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
    const getFirst = async () => {
        const stmt = db.prepare(
            'SELECT pending_news.*, webhooks.url AS webhookUrl FROM pending_news JOIN webhooks ON pending_news.webhook_id = webhooks.id ORDER BY pending_news.id ASC LIMIT 1'
        )
        return await stmt.first()
    }

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
