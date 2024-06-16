import { Feed } from 'feed'
import { parse } from 'node-html-parser'

const baseurl = 'https://tw.toram.jp'
const path = '/information/?type_code=all'
const url = `${baseurl}${path}`
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
}

async function fetchNews() {
    const news = []

    try {
        const response = await fetch(url, { headers })

        if (response.status !== 200) {
            throw new Error(`Status code: ${response.status}`)
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
    } catch (error) {
        console.error(error)
    }

    return news
}

async function checkUpdates(env, news) {
    try {
        const updates = []
        const prevNews = JSON.parse(await env.TORAM.get('news')) || []
        const prevNewsLinks = prevNews.map((item) => item.link)

        for (const item of news) {
            if (!prevNewsLinks.includes(item.link)) {
                // Fetch image of the news, add delay to avoid being blocked
                await new Promise((resolve) => setTimeout(resolve, 3000))
                const response = await fetch(item.link, { headers })

                if (response.status === 200) {
                    const content = await response.text()
                    const root = parse(content)
                    const img = root.querySelector('div.useBox.newsBox')?.querySelector('img')?.getAttribute('src')
                    if (img) item.img = img
                }

                updates.push(item)
            } else {
                break
            }
        }

        return {
            updates,
            prevNews,
        }
    } catch (error) {
        console.error(error)
        return {
            updates: [],
        }
    }
}

async function generateFeed(env, news) {
    try {
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

        await env.FEEDS.put('/toram', feed.rss2())
    } catch (error) {
        console.error(error)
    }
}

async function sendDiscordUpdates(env, updates) {
    const webhooks = JSON.parse(await env.TORAM.get('discord-webhooks')) || []

    try {
        while (updates.length) {
            const news = updates.pop()
            await Promise.allSettled(
                webhooks.map((webhookUrl) =>
                    fetch(webhookUrl, {
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
                                        url: news.img,
                                    },
                                    thumbnail: {
                                        url: news.thumbnail,
                                    },
                                },
                            ],
                        }),
                    })
                )
            )
            await new Promise((resolve) => setTimeout(resolve, 1000))
        }
    } catch (error) {
        console.error(error)
    }
}

export default {
    async scheduled(event, env, ctx) {
        try {
            const news = await fetchNews()
            if (!news.length) return

            const { updates, prevNews } = await checkUpdates(env, news)
            if (!updates.length) return

            // Keep only the latest 10 news
            const updatedNews = [...updates, ...prevNews].slice(0, 10)

            await env.TORAM.put('news', JSON.stringify(updatedNews))
            await generateFeed(env, updatedNews)
            await sendDiscordUpdates(env, updates)
        } catch (error) {
            console.error(error)
        }
    },
}
