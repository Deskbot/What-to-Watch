import * as cheerio from "cheerio"
import fetch, { RequestInfo, RequestInit } from "node-fetch"
import * as querystring from "querystring"
import { closestSearchResult } from "../search"
import { getHighest, limitConcurrent } from "../util"
import { getRateLimit } from "../args"

const rottenTomatoesFetch = (url: RequestInfo, init?: (RequestInit & { headers?: { [key: string]: string } })) => {
    // make the website like us
    const userAgent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:103.0) Gecko/20100101 Firefox/103.0"

    init = init ?? {}
    init.headers = init.headers ?? {}
    init.headers["User-Agent"] = userAgent

    return fetch(url, init)
}

export type RottenTomatoesScore = number | "not found"

export type RottenTomatoesResult = {
    name: string
    url: string
    criticScore: RottenTomatoesScore
    audienceScore: RottenTomatoesScore
}

export const getRottenTomatoesData = limitConcurrent(getRateLimit(), getData)

export async function getData(movie: string): Promise<RottenTomatoesResult | undefined> {
    const searchUrl = `https://www.rottentomatoes.com/search?search=${querystring.escape(movie)}`

    const searchPageText = await rottenTomatoesFetch(searchUrl)
        .then(res => res.text())

    const searchPage = cheerio.load(searchPageText)

    const searchResults = searchPage("search-page-result[type=movie] search-page-media-row")
        .toArray()
        .map(searchPage)
        .map(elem => new SearchResult(elem))

    // find best match
    const targetResults = closestSearchResult(movie, searchResults, result => result.name)
    if (targetResults.length === 0) {
        return undefined
    }

    // if there are multiple matches, get the one with the best score
    // to disambiguate Shrek (2001) from Shrek (2018)

    const bestResult = getHighest(targetResults, (result1, result2) => {
        const criticScore1 = result1.criticScore
        const criticScore2 = result2.criticScore

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
    readonly name: string
    readonly reviewPageUrl: string
    readonly criticScore: RottenTomatoesScore

    constructor(searchResultElem: cheerio.Cheerio) {
        const linkToMoviePage = searchResultElem.find("[slot=title]")

        const name = linkToMoviePage.text().trim()
        const year = searchResultElem.attr("releaseyear") ?? ""

        this.name = `${name} (${year})`
        this.reviewPageUrl = linkToMoviePage.attr("href") ?? ""
        this.criticScore = this.getCriticScore(searchResultElem)
    }

    private getCriticScore(searchResultElem: cheerio.Cheerio): RottenTomatoesScore {
        const criticScoreNum = parseInt(searchResultElem.attr("tomatometerscore") ?? "")
        return Number.isNaN(criticScoreNum) ? "not found" : criticScoreNum
    }

    async toRottenTomatoesResult() {
        const audienceScore = await getAudienceScore(this.reviewPageUrl);
        return {
            name: this.name,
            url: this.reviewPageUrl,
            criticScore: this.criticScore,
            audienceScore,
        }
    }
}

async function getAudienceScore(reviewPageUrl: string): Promise<RottenTomatoesScore> {
    const reviewPageText = await rottenTomatoesFetch(reviewPageUrl)
        .then(res => res.text())

    const reviewPage = cheerio.load(reviewPageText)

    const percentageText = reviewPage("score-icon-audience").attr("percentage")
    const percentage = parseInt(percentageText ?? "")

    return Number.isNaN(percentage) ? "not found" : percentage
}
