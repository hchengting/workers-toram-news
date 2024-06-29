import fs from 'fs'
import { parse } from 'node-html-parser'
import { convert } from 'html-to-text'

const baseurl = 'https://tw.toram.jp'
const path = '/information/detail/?information_id=9153'
const newsUrl = `${baseurl}${path}`

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
}

const webhookUrl = 'https://discord.com/api/webhooks/1251791333748637768/E745Ne4UR-YdsvcfYi0CuxIwztxV7Z1_TD_qQe-dIaCxjfrvbp3NcqFZLTlVacMhY7jD'

const body = {
    embeds: [],
}

async function main() {
    const response = await fetch(newsUrl, { headers })
    const content = await response.text()

    const root = parse(content)
    const newsBox = root.querySelector('div.useBox.newsBox')
    const children = newsBox.childNodes.slice(
        newsBox.childNodes.findIndex((child) => child.classList?.contains('smallTitleLine')) + 1,
        newsBox.childNodes.findIndex((child) => child.classList?.contains('deluxetitle') && child.text === '注意事項')
    )

    const sections = [[root.querySelector('title').text]]

    for (const child of children) {
        if (child.text == '回頁面頂端') continue

        if (child?.classList?.contains('deluxetitle') && child.toString().includes('id=')) {
            sections.push([child])
        } else {
            sections[sections.length - 1].push(child)
        }
    }

    for (const [head, ...contents] of sections) {
        const title = head.text || head
        const url = head.id ? `${newsUrl}#${head.id}` : typeof head === 'string' ? newsUrl : undefined
        const content = parse(contents.join(''))

        const description = convert(content.toString(), {
            wordwrap: false,
            selectors: [
                { selector: 'a', options: { baseUrl: 'https:' } },
                { selector: 'hr', format: 'skip' },
                { selector: 'img', format: 'skip' },
                { selector: 'table', format: 'dataTable' },
            ],
        }).replace(/\n{3,}/g, '\n\n')

        const images = content.querySelectorAll('img')
        const image = images.shift()

        const embed = {
            title,
            url,
            description,
            image: {
                url: image?.getAttribute('src'),
            },
        }

        body.embeds.push(embed)

        for (const image of images) {
            body.embeds.push({
                url,
                image: {
                    url: image.getAttribute('src'),
                },
            })
        }
    }

    fetch(`${webhookUrl}?wait=true`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })

    // fs.writeFileSync('body.json', JSON.stringify(body, null, 4))
}

main()
