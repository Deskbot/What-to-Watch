import * as cheerio from "cheerio"
import fetch, { RequestInfo, RequestInit } from "node-fetch"
import * as querystring from "querystring"
import { closestSearchResult } from "../search"
import { limitConcurrent } from "../util"

const rottenTomatoesFetch = limitConcurrent(
    4,
    (url: RequestInfo, init?: (RequestInit & { headers?: { [key: string]: string } })) => {
        // make the website like us
        const userAgent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:103.0) Gecko/20100101 Firefox/103.0"

        init = init ?? {}
        init.headers = init.headers ?? {}
        init.headers["User-Agent"] = userAgent

        return fetch(url, init)
    }
)

export type RottenTomatoesScore = number | "not found"

export type RottenTomatoesResult = {
    name: string
    url: string
    criticScore: RottenTomatoesScore
    audienceScore: RottenTomatoesScore
}

export async function getRottenTomatoesData(movie: string): Promise<RottenTomatoesResult | undefined> {
    const searchUrl = `https://www.rottentomatoes.com/search?search=${querystring.escape(movie)}`

    const searchPageText = await rottenTomatoesFetch(searchUrl)
        .then(res => res.text())

    const searchPage = cheerio.load(searchPageText)

    const searchResultElems = searchPage("search-page-result[type=movie] search-page-media-row")
        .toArray()
        .map(searchPage)
        .map(elem => new SearchResult(elem))

    // find best match
    const targetResultElem = closestSearchResult(movie, searchResultElems, result => result.getName())
    if (targetResultElem.length === 0) {
        return undefined
    }

    return await targetResultElem[0].toRottenTomatoesScore()
}

class SearchResult {
    private link: string | undefined
    private name: string | undefined

    constructor(private searchResultElem: cheerio.Cheerio) {}

    private getLink() {
        if (this.link !== undefined) return this.link

        return this.link = this.searchResultElem.find("[slot=title]").text()
    }

    getName() {
        if (this.name !== undefined) return this.name

        const name = this.name = this.getLink().trim()
        const year = this.searchResultElem.find("[class=year]").text();
        return `${name} (${year})`
    }

    private async getAudienceScore(reviewPageUrl: string): Promise<RottenTomatoesScore> {
        const reviewPageText = await rottenTomatoesFetch(reviewPageUrl)
            .then(res => res.text())

        const reviewPage = cheerio.load(reviewPageText)

        const percentageText = reviewPage("score-icon-audience").attr("percentage")
        const percentage = parseInt(percentageText ?? "")

        return Number.isNaN(percentage) ? "not found" : percentage
    }

    async toRottenTomatoesScore(): Promise<RottenTomatoesResult> {
        const link = this.searchResultElem.find("[slot=title]")

        const name = this.getName()
        const url = link.attr("href") ?? ""
        const criticScore = parseInt(this.searchResultElem.attr("tomatometerscore") ?? "")
        const audienceScore = await this.getAudienceScore(url)

        return {
            name,
            url,
            criticScore: Number.isNaN(criticScore) ? "not found" : criticScore,
            audienceScore,
        }
    }
}
