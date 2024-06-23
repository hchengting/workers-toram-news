import { Feed } from 'feed'
import { parse } from 'node-html-parser'
import query from './query'

const baseurl = 'https://tw.toram.jp'
const path = '/information/?type_code=all'
const url = `${baseurl}${path}`
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
}

async function fetchNews() {
    const news = []
    const response = await fetch(url, { headers })

    if (response.status !== 200) {
        throw new Error(`Failed to fetch ${url}, status code: ${response.status}`)
    }

    const content = await response.text()
    const root = parse(content)
    const newsNodeList = root.querySelectorAll('div.useBox > ul > li.news_border')

    for (const newsNode of newsNodeList) {
        const date = newsNode.querySelector('time').getAttribute('datetime')
        const title = newsNode.querySelector('p.news_title').text
        const link = `${baseurl}${newsNode.querySelector('a').getAttribute('href')}`
        const thumbnail = newsNode.querySelector('img').getAttribute('src')

        news.push({
            date,
            title,
            link,
            thumbnail,
        })
    }

    // Newest first
    return news
}

async function fetchNewsImage(link) {
    await new Promise((resolve) => setTimeout(resolve, 1000))

    try {
        const response = await fetch(link, { headers })
        if (response.status !== 200) return undefined

        const content = await response.text()
        const root = parse(content)
        const img = root.querySelector('div.useBox.newsBox')?.querySelector('img')?.getAttribute('src')

        return img
    } catch (error) {
        console.error(error)
        return undefined
    }
}

async function updateLatestNews(queryLatestNews, news) {
    const latestNews = await queryLatestNews.list()
    const latestNewsLinks = latestNews.map((n) => n.link)
    const updates = []

    // Check for updates
    for (const item of news) {
        if (!latestNewsLinks.includes(item.link)) {
            item.img = await fetchNewsImage(item.link)
            updates.push(item)
        } else break
    }

    // Oldest first
    updates.reverse()

    // Update latest news
    if (updates.length) await queryLatestNews.insert(updates)

    return updates
}

async function generateFeed(kv, queryLatestNews) {
    const news = (await queryLatestNews.list()).reverse()

    const feed = new Feed({
        title: '托蘭異世錄官網 - Toram Online -',
        description: '托蘭異世錄官網 - Toram Online - 公告',
        id: url,
        link: url,
        language: 'zh-TW',
        image: `${baseurl}/favicon.ico`,
        favicon: `${baseurl}/favicon.ico`,
        updated: new Date(),
    })

    for (const item of news) {
        feed.addItem({
            title: item.title,
            id: item.link,
            link: item.link,
            date: new Date(item.date),
            image: item.img,
        })
    }

    await kv.put('/toram', feed.rss2())
}

function postDiscordWebhook(webhookUrl, news) {
    try {
        return fetch(`${webhookUrl}?wait=true`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                embeds: [
                    {
                        title: `[${news.date}] ${news.title}`,
                        url: news.link,
                        image: {
                            url: news.img || undefined,
                        },
                        thumbnail: {
                            url: news.thumbnail || undefined,
                        },
                    },
                ],
            }),
        })
    } catch (error) {
        console.error(error)
        return undefined
    }
}

async function sendPendingNews(queryPendingNews) {
    while (true) {
        const news = await queryPendingNews.getFirst()
        if (!news) break

        // Retry 5 times
        let success = false
        for (let i = 1; i <= 5; i++) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * i))
            const res = await postDiscordWebhook(news.webhookUrl, news)
            if (res?.status === 200) {
                success = true
                break
            }
            console.error(`Failed to post webhook ${news.webhookUrl}, status code: ${res?.status}`)
        }

        if (!success) {
            throw new Error(`Failed to post webhook ${news.webhookUrl}`)
        }

        await queryPendingNews.deleteFirst()
    }
}

export default {
    async scheduled(event, env, ctx) {
        const queryLatestNews = query.latestNews(env.TORAM)
        const queryPendingNews = query.pendingNews(env.TORAM)

        const news = await fetchNews()
        const updates = await updateLatestNews(queryLatestNews, news)

        if (updates.length) {
            await generateFeed(env.FEEDS, queryLatestNews)
            await queryPendingNews.insert(updates)
        }

        await sendPendingNews(queryPendingNews)
    },
}
