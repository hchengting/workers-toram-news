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

    return news
}

async function fetchNewsImage(link) {
    // Delay avoid being blocked
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

async function checkUpdates(env, news) {
    const updates = []
    const prevNews = JSON.parse(await env.TORAM.get('news')) || []
    const prevNewsLinks = prevNews.map((item) => item.link)

    for (const item of news) {
        if (!prevNewsLinks.includes(item.link)) {
            item.img = await fetchNewsImage(item.link)
            updates.push(item)
        }
    }

    return {
        updates,
        updatedNews: [...updates, ...prevNews].slice(0, 10),
    }
}

async function generateFeed(env, news) {
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
}

function postDiscordWebhook(webhook, news) {
    try {
        return fetch(`${webhook}?wait=true`, {
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
    } catch (error) {
        console.error(error)
        return undefined
    }
}

async function sendDiscordUpdates(env, updates) {
    const webhooks = JSON.parse(await env.TORAM.get('discord-webhooks')) || [] // [webhook1, webhook2...]
    const unsentUpdates = JSON.parse(await env.TORAM.get('discord-unsent-updates')) || {} // { webhook1: [news1, news2...], webhook2: [news1, news2...] }
    
    // Remove invalid webhooks from unsent updates
    Object.keys(unsentUpdates).forEach((webhook) => {
        if (!webhooks.includes(webhook)) {
            delete unsentUpdates[webhook]
        }
    })

    // Group updates by webhook
    for (const webhook of webhooks) {
        if (unsentUpdates[webhook]) {
            unsentUpdates[webhook].unshift(...updates)
        } else {
            unsentUpdates[webhook] = [...updates]
        }
    }

    try {
        while (Object.values(unsentUpdates).reduce((acc, val) => acc + val.length, 0)) {
            // Round-robin updates
            for (const webhook in unsentUpdates) {
                const news = unsentUpdates[webhook].pop()
                if (news) {
                    const res = await postDiscordWebhook(webhook, news)
                    if (res?.status !== 200) {
                        unsentUpdates[webhook].push(news)
                        throw new Error(`Failed to post webhook ${webhook}, status code: ${res?.status}`)
                    }
                    await new Promise((resolve) => setTimeout(resolve, 1000))
                }
            }
        }
    } catch (error) {
        console.error(error)
    }

    // Remove empty unsent updates
    for (const webhook in unsentUpdates) {
        if (!unsentUpdates[webhook].length) {
            delete unsentUpdates[webhook]
        }
    }

    // Save unsent updates
    await env.TORAM.put('discord-unsent-updates', JSON.stringify(unsentUpdates))
}

export default {
    async scheduled(event, env, ctx) {
        const news = await fetchNews()
        const { updates, updatedNews } = await checkUpdates(env, news)

        if (updates.length) {
            await generateFeed(env, updatedNews)
            await env.TORAM.put('news', JSON.stringify(updatedNews))
        }

        await sendDiscordUpdates(env, updates)
    },
}
