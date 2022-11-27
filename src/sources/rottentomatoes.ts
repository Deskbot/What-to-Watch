import * as cheerio from "cheerio"
import fetch, { RequestInfo, RequestInit } from "node-fetch"
import * as querystring from "querystring"
import { closestSearchResult } from "../search"
import { getHighest, limitConcurrent } from "../util"

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

    const searchResults = searchPage("search-page-result[type=movie] search-page-media-row")
        .toArray()
        .map(searchPage)
        .map(elem => new SearchResult(elem))

    // find best match
    const targetResults = closestSearchResult(movie, searchResults, result => result.getName())
    if (targetResults.length === 0) {
        return undefined
    }

    // if there are multiple matches, get the one with the best score
    // to disambiguate Shrek (2001) from Shrek (2018)

    const bestResult = getHighest(targetResults, (result1, result2) => {
        const criticScore1 = result1.getCriticScore()
        const criticScore2 = result2.getCriticScore()

        if (typeof criticScore1 !== "number") {
            return -1
        }

        if (typeof criticScore2 !== "number") {
            return 1
        }

        return criticScore1 - criticScore2
    })

    return bestResult?.toRottenTomatoesResult()
}

class SearchResult {
    private linkToMoviePage: cheerio.Cheerio | undefined
    private name: string | undefined
    private criticScore: RottenTomatoesScore | undefined

    constructor(private searchResultElem: cheerio.Cheerio) { }

    private getLinkToMoviePage() {
        if (this.linkToMoviePage !== undefined) return this.linkToMoviePage

        return this.linkToMoviePage = this.searchResultElem.find("[slot=title]")
    }

    getName() {
        if (this.name !== undefined) return this.name

        const name = this.getLinkToMoviePage().text().trim()
        const year = this.searchResultElem.attr("releaseyear") ?? ""
        return `${name} (${year})`
    }

    getCriticScore() {
        if (this.criticScore !== undefined) return this.criticScore

        const criticScoreNum = parseInt(this.searchResultElem.attr("tomatometerscore") ?? "")
        return this.criticScore = Number.isNaN(criticScoreNum) ? "not found" : criticScoreNum
    }

    private async getAudienceScore(reviewPageUrl: string): Promise<RottenTomatoesScore> {
        const reviewPageText = await rottenTomatoesFetch(reviewPageUrl)
            .then(res => res.text())

        const reviewPage = cheerio.load(reviewPageText)

        const percentageText = reviewPage("score-icon-audience").attr("percentage")
        const percentage = parseInt(percentageText ?? "")

        return Number.isNaN(percentage) ? "not found" : percentage
    }

    async toRottenTomatoesResult(): Promise<RottenTomatoesResult> {
        const name = this.getName()
        const url = this.getLinkToMoviePage().attr("href") ?? ""
        const criticScore = this.getCriticScore()
        const audienceScore = await this.getAudienceScore(url)

        return {
            name,
            url,
            criticScore,
            audienceScore,
        }
    }
}
