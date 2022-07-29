import { getImdbData, ImdbResult } from "./imdb"
import { getMetacriticData, MetacriticResult } from "./metacritic"
import { getRottenTomatoesData, RottenTomatoesResult } from "./rottentomatoes"
import { average, csvFriendly, printable } from "./util"

export interface AllData {
    movie: string
    aggregateScore?: number
    imdb?: ImdbResult
    metacritic?: MetacriticResult
    rottentomatoes?: RottenTomatoesResult
}

export const csvHeaders = [
    "Movie",
    "Aggregate Score",
    "Metacritic Name",
    "Metacritic Critic Score",
    "Metacritic User Score",
    "IMDB Name",
    "IMDB Score",
    "Rotten Tomatoes Name",
    "Rotten Tomatoes Critic Score",
    "Rotten Tomatoes Audience Score",
] as const
export const csvHeaderRow = csvHeaders.join(",")

export type CsvHeaders = typeof csvHeaders[number]

export function aggregateScore(
    metacriticData: MetacriticResult | undefined,
    imdbData: ImdbResult | undefined,
    rottenTomatoesData: RottenTomatoesResult | undefined,
): number | undefined {
    const scores = [] as number[]

    const imdb_score = imdbData?.score
    const metacritic_metascore = metacriticData?.metascore
    const metacritic_userscore = metacriticData?.userscore
    const rottentomatoes_audienceScore = rottenTomatoesData?.audienceScore
    const rottentomatoes_criticScore = rottenTomatoesData?.criticScore

    // make all scores out of 100
    if (typeof imdb_score === "number") {
        scores.push(imdb_score * 10)
    }
    if (typeof metacritic_metascore === "number") {
        scores.push(metacritic_metascore)
    }
    if (typeof metacritic_userscore === "number") {
        scores.push(metacritic_userscore * 10)
    }
    if (typeof rottentomatoes_audienceScore === "number") {
        scores.push(rottentomatoes_audienceScore)
    }
    if (typeof rottentomatoes_criticScore === "number") {
        scores.push(rottentomatoes_criticScore)
    }

    if (scores.length === 0) {
        return undefined
    }

    return parseFloat(average(scores).toFixed(1))
}

const aggregateScoreFormula = (function(): string {
    // get cell references

    // const gog_score = csvHeaders.indexOf("GOG Score") + 1
    // const metacritic_metascore = csvHeaders.indexOf("Metacritic Critic Score") + 1
    // const metacritic_userscore = csvHeaders.indexOf("Metacritic User Score") + 1
    // const steam_allTimeScore = csvHeaders.indexOf("Steam All Time % Positive") + 1
    // const steam_recentScore = csvHeaders.indexOf("Steam Recent % Positive") + 1

    // const gog_score_cell = getCellInCol(gog_score)
    // const metacritic_metascore_cell = getCellInCol(metacritic_metascore)
    // const metacritic_userscore_cell = getCellInCol(metacritic_userscore)
    // const steam_allTimeScore_cell = getCellInCol(steam_allTimeScore)
    // const steam_recentScore_cell = getCellInCol(steam_recentScore)

    // const cells = [
    //     gog_score_cell,
    //     metacritic_metascore_cell,
    //     metacritic_userscore_cell,
    //     steam_allTimeScore_cell,
    //     steam_recentScore_cell,
    // ]

    // // normalise the scores to be out of 100
    // const scoreExpressions = [
    //     `(${gog_score_cell} * 20)`,
    //     `(${metacritic_metascore_cell})`,
    //     `(${metacritic_userscore_cell} * 10)`,
    //     `(${steam_allTimeScore_cell})`,
    //     `(${steam_recentScore_cell})`,
    // ]

    // // average the scores, ensure blank cells don't contribute to the average
    // const average = `(${scoreExpressions.join(" + ")}) / ${count(cells)}`

    // return `=IFERROR(${average}, "")`

    return ""
})()

/**
 * @param movie Movie to get data for
 */
export async function getCsv(movie: string): Promise<string> {
    const buffer = [] as string[]

    const data = await getData(movie)

    const newData: Record<CsvHeaders, string | number | undefined> = {
        "Movie": data.movie,
        "Aggregate Score": aggregateScoreFormula,
        "Metacritic Name": data.metacritic?.name,
        "Metacritic Critic Score": data.metacritic?.metascore,
        "Metacritic User Score": data.metacritic?.userscore,
        "IMDB Name": data.imdb?.name,
        "IMDB Score": data.imdb?.score,
        "Rotten Tomatoes Name": data.rottentomatoes?.name,
        "Rotten Tomatoes Critic Score": data.rottentomatoes?.criticScore,
        "Rotten Tomatoes Audience Score": data.rottentomatoes?.audienceScore,
    }

    // iterate through in the same order every time guaranteed
    for (const key of csvHeaders) {
        buffer.push(csvFriendly(printable(newData[key])))
    }

    return buffer.join(",")
}

/**
 * @param movie Movie to get data for
 */
export async function getData(movie: string): Promise<AllData> {
    const handleError = (err: unknown, website: string) => {
        console.error(`Error: code failure, when getting "${movie}" from ${website}`)
        console.error(err)
        return undefined
    }

    const imdbDataProm =           getImdbData(movie)          .catch(err => handleError(err, "IMDB"))
    const metacriticDataProm =     getMetacriticData(movie)    .catch(err => handleError(err, "Metacritic"))
    const rottentomatoesDataProm = getRottenTomatoesData(movie).catch(err => handleError(err, "Rotten Tomatoes"))

    // spawn all promises before blocking on their results
    const imdbData = await imdbDataProm
    const metacriticData = await metacriticDataProm
    const rottentomatoesData = await rottentomatoesDataProm

    return {
        movie,
        aggregateScore: aggregateScore(metacriticData, imdbData, rottentomatoesData),
        imdb: imdbData,
        metacritic: metacriticData,
        rottentomatoes: rottentomatoesData,
    }
}

/**
 * @param movie Movie to get data for
 */
export async function getJson(movie: string): Promise<string> {
    return JSON.stringify(await getData(movie))
}
