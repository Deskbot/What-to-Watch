import * as cheerio from "cheerio"
import fetch, { RequestInfo, RequestInit } from "node-fetch"
import * as querystring from "querystring"
import { closestSearchResult } from "../search"
import { bug, limitConcurrent } from "../util"

const imdbFetch = limitConcurrent(1, (url: RequestInfo, init?: (RequestInit & { headers?: { [key: string]: string } })) => {
    // make the website like us
    const userAgent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/111.0"

    init = init ?? {}
    init.headers = init.headers ?? {}
    init.headers["User-Agent"] = userAgent

    return fetch(url, init)
})

export type ImdbScore = number | "not found"

export type ImdbResult = {
    name: string,
    url: string,
    score: ImdbScore,
}

export async function getImdbData(movie: string): Promise<ImdbResult | undefined> {
    const movieStr = querystring.escape(movie)
    const searchUrl = `https://www.imdb.com/find?q=${movieStr}&s=tt&ttype=ft&ref_=fn_ft`

    const searchPageText = await imdbFetch(searchUrl)
        .then(res => res.text())

    const searchPage = cheerio.load(searchPageText)

    // find movies in the search page

    const searchResultsList = searchPage("ul.ipc-metadata-list")
        .first()
        .children("li")
        .toArray()

    const searchResults: SearchResult[] = []

    for (const li of searchResultsList) {
        const result = new SearchResult(searchPage(li))

        if (result.isReleased()) {
            searchResults.push(result)
        }
    }

    // find best string match
    const bestResults = closestSearchResult(
        movie,
        searchResults,
        result => result.name,
    )

    // get score data of best results
    const imdbResults = await Promise.all(bestResults.map(r => r.toImdbResult()))

    // when there are several equally good matches (e.g. films with the same name),
    // output the one with the best score

    let bestScore: ImdbScore | undefined = undefined
    let bestResult: ImdbResult | undefined

    for (const result of imdbResults) {
        if (bestScore === undefined || result.score > bestScore) {
            bestResult = result
            bestScore = result.score
        }
    }

    if (!bestResult) {
        return undefined
    }

    return {
        name: bestResult.name,
        url: bestResult.url,
        score: bestResult.score,
    }
}

class SearchResult {
    readonly year: number
    readonly name: string
    readonly url: string
    readonly score: Promise<ImdbScore>

    constructor(dom: cheerio.Cheerio) {
        this.url = this.getUrl(dom)
        this.year = this.getYear(dom)
        this.name = this.getName(dom)
        this.score =  this.getScore(this.url)
    }

    isReleased(): boolean {
        return this.year !== -1
    }

    private getYear(dom: cheerio.Cheerio): number {
        const yearStr = dom.find(".ipc-metadata-list-summary-item__tl").first().text()

        const year = parseInt(yearStr)
        if (Number.isNaN(year)) {
            return -1 // no year given
        }

        return year
    }

    // if 2 movies with the same name are released in the same year, imdb puts parentheses to differentiate
    private static romanNumeralParentheses = /\([ivxldcm]+\)/gi
    // 2 or more spaces in sequence
    private static whitespace = /\s\s+/g

    private getName(dom: cheerio.Cheerio): string {
        const a = dom.find("a.ipc-metadata-list-summary-item__t")
        let name = a.text()

        name = name.replace(SearchResult.romanNumeralParentheses, "") // remove all roman numeral parentheses
        name = name.replace(SearchResult.whitespace, " ") // the above step may have introduced whitespace
        name = name.trim()

        return name
    }

    private getUrl(dom: cheerio.Cheerio): string {
        const a = dom.find("a.ipc-metadata-list-summary-item__t")

        const href = a.attr("href")
        if (!href) bug()

        const url = absoluteUrl(href)
        if (!url) bug()

        return url
    }

    private async getScore(url: string): Promise<ImdbScore> {
        const reviewPageText = await imdbFetch(url).then(res => res.text())
        const reviewPage = cheerio.load(reviewPageText)

        return getScoreFromPage(reviewPage)
    }

    async toImdbResult(): Promise<ImdbResult> {
        return {
            name: this.name,
            url: this.url,
            score: await this.getScore(this.url),
        }
    }
}

async function getScoreFromPage(reviewPage: cheerio.Root): Promise<ImdbScore> {
    const scoreStr = reviewPage.root()
        .find("[data-testid=hero-rating-bar__aggregate-rating__score]")
        .first()
        .children()
        .first()
        .text()
        .trim()

    if (scoreStr == "") return "not found"

    const score = parseFloat(scoreStr)

    if (Number.isNaN(score)) return "not found"

    return score
}

function absoluteUrl(relativeUrl: string): string {
    return "https://www.imdb.com" + relativeUrl
}
