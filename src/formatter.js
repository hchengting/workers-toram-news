const formatters = {
    formatAnchor: (elem, walk, builder, _) => {
        const isText = elem.children?.filter((child) => child.type === 'text')?.length === 1
        const href = elem.attribs?.href || ''

        if (isText && href) {
            builder.startNoWrap()
            builder.addLiteral(`[`)
            walk(elem.children, builder)
            builder.addLiteral(`](`)
            builder.addInline(href, { noWordTransform: true })
            builder.addLiteral(`)`)
            builder.stopNoWrap()
        } else {
            walk(elem.children, builder)
            builder.addInline(href, { noWordTransform: true })
        }
    },
    formatTable: (elem, walk, builder, _) => {
        const walkTable = (elem) => {
            if (elem.type !== 'tag') return

            switch (elem.name) {
                case 'thead':
                case 'tbody':
                case 'tfoot':
                case 'center':
                    elem.children.forEach(walkTable)
                    break
                case 'tr':
                    builder.openTableRow()
                    for (const cell of elem.children) {
                        if (cell.name === 'th' || cell.name === 'td') {
                            builder.openTableCell()
                            walk(cell.children, builder)
                            builder.closeTableCell()
                        }
                    }
                    builder.closeTableRow()
                    break
            }
        }

        builder.openTable()
        elem.children.forEach(walkTable)
        builder.closeTable({ tableToString: (rows) => rows.map((row) => row.map((cell) => cell.text).join(' | ')).join('\n') })
    },
}

export default formatters
