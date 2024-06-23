const latestNews = (db) => {
    // Batch insert news and keep only the latest 10
    const insert = async (news) => {
        const stmts = [
            db.prepare('INSERT INTO latest_news (date, title, link, thumbnail, img) VALUES (?, ?, ?, ?, ?)'),
            db.prepare('DELETE FROM latest_news WHERE id NOT IN (SELECT id FROM latest_news ORDER BY id DESC LIMIT 10)'),
        ]
        await db.batch([...news.map((n) => stmts[0].bind(n.date, n.title, n.link, n.thumbnail || '', n.img || '')), stmts[1]])
    }

    // List all news
    const list = async () => (await db.prepare('SELECT * FROM latest_news ORDER BY id ASC').all()).results

    return {
        insert,
        list,
    }
}

// News that are pending for sending to webhooks
const pendingNews = (db) => {
    // Batch insert updates with webhook id into pending news
    const insert = async (updates) => {
        const stmts = [
            db.prepare('CREATE TABLE temp_updates (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, title TEXT, link TEXT, thumbnail TEXT, img TEXT)'),
            db.prepare('INSERT INTO temp_updates (date, title, link, thumbnail, img) VALUES (?, ?, ?, ?, ?)'),
            db.prepare(
                'INSERT INTO pending_news (webhook_id, date, title, link, thumbnail, img) SELECT webhooks.id, temp_updates.date, temp_updates.title, temp_updates.link, temp_updates.thumbnail, temp_updates.img FROM temp_updates CROSS JOIN webhooks ORDER BY temp_updates.id ASC'
            ),
            db.prepare('DROP TABLE temp_updates'),
        ]

        await db.batch([stmts[0], ...updates.map((n) => stmts[1].bind(n.date, n.title, n.link, n.thumbnail || '', n.img || '')), stmts[2], stmts[3]])
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
    pendingNews,
}

export default query
