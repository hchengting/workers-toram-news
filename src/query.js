const latestNews = (db) => {
    // Check if the news exists
    const includes = async (news) => !!(await db.prepare('SELECT * FROM latest_news WHERE link = ?').bind(news.link).first())

    // Insert news
    const push = async (news) =>
        await db
            .prepare('INSERT INTO latest_news (date, title, link, thumbnail, img) VALUES (?, ?, ?, ?, ?)')
            .bind(news.date, news.title, news.link, news.thumbnail || '', news.img || '')
            .run()

    // Keep only the last 10 news
    const slice = async () => await db.prepare('DELETE FROM latest_news WHERE id NOT IN (SELECT id FROM latest_news ORDER BY id DESC LIMIT 10)').run()

    // List all news in descending order
    const list = async () => (await db.prepare('SELECT * FROM latest_news ORDER BY id DESC').all()).results

    return {
        includes,
        push,
        slice,
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
    // Insert pending news
    const push = async (webhookId, news) =>
        await db
            .prepare('INSERT INTO pending_news (webhook_id, date, title, link, thumbnail, img) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(webhookId, news.date, news.title, news.link, news.thumbnail || '', news.img || '')
            .run()

    // Get the first pending news
    const next = async () =>
        await db
            .prepare(
                'SELECT pending_news.*, webhooks.url AS webhookUrl FROM pending_news JOIN webhooks ON pending_news.webhook_id = webhooks.id ORDER BY pending_news.id ASC LIMIT 1'
            )
            .first()

    // Delete the first pending news
    const pop = async () => await db.prepare('DELETE FROM pending_news WHERE id = (SELECT id FROM pending_news ORDER BY id ASC LIMIT 1)').run()

    return {
        push,
        next,
        pop,
    }
}

const query = {
    latestNews,
    webhooks,
    pendingNews,
}

export default query
