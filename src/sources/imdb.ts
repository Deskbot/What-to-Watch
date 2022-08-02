import * as cheerio from "cheerio"
import fetch from "node-fetch"
import * as querystring from "querystring"
import { closestSearchResult } from "../search"
import { bug, buildMapFromAsyncOptional, limitConcurrent } from "../util"

const imdbFetch = limitConcurrent(1, fetch)

export type ImdbScore = number | "not found"

export type ImdbResult = {
    name: string,
    url: string,
    score: ImdbScore,
}

export async function getImdbData(movie: string): Promise<ImdbResult | undefined> {
    const searchResult = await search(movie)
    if (!searchResult) {
        return undefined
    }

    return {
        name: searchResult.getName(),
        score: await searchResult.getScore(),
        url: searchResult.getUrl(),
    }
}

async function search(movie: string): Promise<SearchResult | undefined> {
    const movieStr = querystring.escape(movie)
    const searchUrl = `https://www.imdb.com/find?q=${movieStr}&s=tt&ttype=ft`

    const searchPageText = await imdbFetch(searchUrl).then(res => res.text())
    const searchPage = cheerio.load(searchPageText)

    const searchResults = searchPage(".article")
        .find(".result_text")
        .toArray()
        .map(searchPage)
        .map(dom => new SearchResult(dom))

    // find best string match
    const bestResults = closestSearchResult(
        movie,
        searchResults.filter(result => result.getIsReleased()),
        result => result.getName(),
    )

    // get scores outside of promises
    const searchResultScores = await buildMapFromAsyncOptional(bestResults, async (searchResult) => {
        const score = await searchResult.getScore()
        if (score !== "not found") {
            return score
        }

        return undefined
    })

    // when there are several equally good matches (e.g. films with the same name),
    // output the one with the best score

    let bestScore: ImdbScore | undefined = undefined
    let bestResult: SearchResult | undefined

    for (const [result, score] of searchResultScores) {
        if (bestScore === undefined || score > bestScore) {
            bestResult = result
            bestScore = score
        }
    }

    return bestResult
}

class SearchResult {
    private year: number | undefined
    private isReleased: boolean | undefined
    private name: string | undefined
    private url: string | undefined
    private score: ImdbScore | undefined

    constructor(private dom: cheerio.Cheerio) {}

    getIsReleased(): boolean {
        if (this.isReleased !== undefined) {
            return this.isReleased
        }

        this.isReleased = this.getYear() !== -1
        return this.isReleased
    }

    private static getYearRegex = /^.* \(([0-9]+)\)$/ // capture group 1 is the numbers inside the parentheses

    getYear(): number {
        if (this.year !== undefined) {
            return this.year
        }

        const name = this.getName()

        const result = SearchResult.getYearRegex.exec(name)
        if (result === null) {
            return -1 // no year given
        }

        const yearStr = result[1]

        const year = parseInt(yearStr)
        if (Number.isNaN(year)) {
            return -1 // no year given
        }

        this.year = year
        return year
    }

    // if 2 movies with the same name are released in the same year, imdb puts parentheses to differentiate
    private static romanNumeralParentheses = /\([ivxldcm]+\)/gi
    // 2 or more spaces in sequence
    private static whitespace = /\s\s+/g

    getName(): string {
        if (this.name !== undefined) {
            return this.name
        }

        let name = this.dom.text()
        name = name.replace(SearchResult.romanNumeralParentheses, "") // remove all roman numeral parentheses
        name = name.replace(SearchResult.whitespace, " ") // the above step may have introduced whitespace
        name = name.trim()

        this.name = name
        return this.name
    }

    getUrl() {
        if (this.url !== undefined) {
            return this.url
        }

        const href = this.dom.find("a").attr("href")
        if (!href) bug()

        const url = absoluteUrl(href)
        if (!url) bug()

        this.url = url
        return url
    }

    async getScore() {
        if (this.score !== undefined) {
            return this.score
        }

        const reviewPageText = await fetch(this.getUrl()).then(res => res.text())
        const reviewPage = cheerio.load(reviewPageText)

        this.score = await getScoreFromPage(reviewPage)
        return this.score
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
