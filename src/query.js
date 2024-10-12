const query = (db) => ({
    // Update latest news and insert pending news
    updateLatestNews: async (deletions, updates, newsEmbeds) => {
        const stmts = [
            // Delete old news and insert updates
            db.prepare('DELETE FROM latest_news WHERE url = ?'),
            db.prepare('INSERT INTO latest_news (date, category, title, url, thumbnail) VALUES (?, ?, ?, ?, ?)'),
            // Insert pending news based on the news category subsribed by each channel
            db.prepare('CREATE TABLE news (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT, category TEXT)'),
            db.prepare('INSERT INTO news (body, category) VALUES (?, ?)'),
            db.prepare(
                'INSERT INTO pending_news (channel_id, body) SELECT cs.channel_id, news.body FROM news JOIN channel_subscriptions cs ON news.category = cs.category ORDER BY news.id ASC'
            ),
            db.prepare('DROP TABLE news'),
        ]

        await db.batch([
            ...deletions.map((n) => stmts[0].bind(n.url)),
            ...updates.map((n) => stmts[1].bind(n.date, n.category, n.title, n.url, n.thumbnail)),
            stmts[2],
            ...newsEmbeds.map((embeds) => stmts[3].bind(JSON.stringify({ embeds }), embeds[0].category)),
            stmts[4],
            stmts[5],
        ])
    },
    // List all latest news
    listLatestNews: async () => {
        return (await db.prepare('SELECT date, category, title, url, thumbnail FROM latest_news ORDER BY id ASC').run()).results
    },
    // If the oldest pending news has not been retrieved for more than 5 minutes, retrieve it and update its retrieval timestamp
    retrievePendingNews: async () => {
        const stmt = db.prepare(
            'UPDATE pending_news SET retrieved_at = unixepoch() WHERE id = (SELECT MIN(id) FROM pending_news) AND unixepoch() - retrieved_at > 300 RETURNING id, channel_id AS channelId, body'
        )

        return await stmt.first()
    },
    // Delete pending news by id
    deletePendingNews: async (id) => {
        await db.prepare('DELETE FROM pending_news WHERE id = ?').bind(id).run()
    },
    // Clear pending news retrieval timestamp by id
    clearPendingNewsRetrieval: async (id) => {
        await db.prepare('UPDATE pending_news SET retrieved_at = 0 WHERE id = ?').bind(id).run()
    },
    // Check if a channel is subscribed to any category
    isChannelSubscribed: async (id) => {
        return !!(await db.prepare('SELECT * FROM channel_subscriptions WHERE channel_id = ? LIMIT 1').bind(id).first())
    },
    // Insert channel subscriptions with categories
    channelSubscribe: async (id, categories) => {
        const stmts = [
            db.prepare('DELETE FROM pending_news WHERE channel_id = ?'),
            db.prepare('DELETE FROM channel_subscriptions WHERE channel_id = ?'),
            db.prepare('INSERT INTO channel_subscriptions (channel_id, category) VALUES (?, ?)'),
        ]

        await db.batch([stmts[0].bind(id), stmts[1].bind(id), ...categories.map((category) => stmts[2].bind(id, category))])
    },
    // Delete channel from pending news and channel subscriptions
    channelUnsubscribe: async (id) => {
        const stmts = [
            db.prepare('DELETE FROM pending_news WHERE channel_id = ?'),
            db.prepare('DELETE FROM channel_subscriptions WHERE channel_id = ?'),
        ]

        await db.batch([stmts[0].bind(id), stmts[1].bind(id)])
    },
})

export default query
