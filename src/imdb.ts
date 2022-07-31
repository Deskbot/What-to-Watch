import * as cheerio from "cheerio"
import fetch from "node-fetch"
import * as querystring from "querystring"
import { closestSearchResult } from "./search"
import { bug } from "./util"

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

    const { name, url } = searchResult

    const reviewPageText = await fetch(url).then(res => res.text())
    const reviewPage = cheerio.load(reviewPageText)

    const score = await getScore(reviewPage)

    return {
        name,
        score,
        url,
    }
}

interface TargetMovie {
    name: string
    url: string
}

async function search(movie: string): Promise<TargetMovie | undefined> {
    const movieStr = querystring.escape(movie)
    const searchUrl = `https://www.imdb.com/find?q=${movieStr}&s=tt&ttype=ft`

    const searchPageText = await fetch(searchUrl).then(res => res.text())
    const searchPage = cheerio.load(searchPageText)

    const searchResults = searchPage(".article")
        .find(".result_text")
        .toArray()
        .map(searchPage)

    function isReleased(elem: cheerio.Cheerio): boolean {
        return getYear(elem) !== -1
    }

    const getYearRegex = /^.* \(([0-9]+)\)$/ // capture group 1 is the numbers inside the parentheses
    function getYear(elem: cheerio.Cheerio): number {
        const name = getName(elem)

        const result = getYearRegex.exec(name)
        if (result === null) {
            return -1 // no year given
        }

        const yearStr = result[1]

        const year = parseInt(yearStr)
        if (Number.isNaN(year)) {
            return -1 // no year given
        }

        return year
    }

    function getName(elem: cheerio.Cheerio): string {
        return elem.text().trim()
    }

    const bestResult = closestSearchResult(
        movie,
        searchResults.filter(isReleased),
        getName,
        (movie1, movie2) => getYear(movie1) - getYear(movie2)
    )

    if (!bestResult) return undefined

    const name = bestResult.text().trim()

    const href = bestResult.find("a").attr("href")
    if (!href) bug()

    const reviewUrl = absoluteUrl(href)
    if (!reviewUrl) bug()

    return {
        name,
        url: reviewUrl,
    }
}

async function getScore(reviewPage: cheerio.Root): Promise<ImdbScore> {
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
