const query = (db) => ({
    // Update latest news and insert pending news
    updateLatestNews: async (deletions, updates, newsEmbeds) => {
        const stmts = [
            // Delete old news and insert updates
            db.prepare('DELETE FROM latest_news WHERE url = ?'),
            db.prepare('INSERT INTO latest_news (title, url, thumbnail, category) VALUES (?, ?, ?, ?)'),
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
            ...updates.map((n) => stmts[1].bind(n.title, n.url, n.thumbnail, n.category)),
            stmts[2],
            ...newsEmbeds.map((embeds) => stmts[3].bind(JSON.stringify({ embeds }), embeds[0].category)),
            stmts[4],
            stmts[5],
        ])
    },
    // List all latest news
    listLatestNews: async () => {
        return (await db.prepare('SELECT title, url, thumbnail, category FROM latest_news ORDER BY id ASC').all()).results
    },
    // Get the first pending news
    getFirstPendingNews: async () => {
        return await db.prepare('SELECT channel_id AS channelId, body FROM pending_news ORDER BY id ASC LIMIT 1').first()
    },
    // Delete the first pending news
    deleteFirstPendingNews: async () => {
        await db.prepare('DELETE FROM pending_news WHERE id = (SELECT id FROM pending_news ORDER BY id ASC LIMIT 1)').run()
    },
    // Check if a channel is subscribed to any category
    isChannelSubscribed: async (id) => {
        return !!(await db.prepare('SELECT * FROM channel_subscriptions WHERE channel_id = ? LIMIT 1').bind(id).first())
    },
    // Insert channel subscriptions with categories
    subscribeChannel: async (id, categories) => {
        const stmts = [
            db.prepare('DELETE FROM channel_subscriptions WHERE channel_id = ?'),
            db.prepare('INSERT INTO channel_subscriptions (channel_id, category) VALUES (?, ?)'),
        ]

        await db.batch([stmts[0].bind(id), ...categories.map((category) => stmts[1].bind(id, category))])
    },
    // Delete channel from channel subscriptions and pending news
    unsubscribeChannel: async (id) => {
        const stmts = [
            db.prepare('DELETE FROM channel_subscriptions WHERE channel_id = ?'),
            db.prepare('DELETE FROM pending_news WHERE channel_id = ?'),
        ]

        await db.batch([stmts[0].bind(id), stmts[1].bind(id)])
    },
})

export default query
