import { getImdbData, ImdbResult } from "./imdb"
import { getMetacriticData, MetacriticResult } from "./metacritic"
import { getRottenTomatoesData, RottenTomatoesResult } from "./rottentomatoes"
import { count, getCellInCol } from "./spreadsheet"
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

    const scoreColumns: CsvHeaders[] = [
        "Metacritic Critic Score",
        "Metacritic User Score",
        "IMDB Score",
        "Rotten Tomatoes Critic Score",
        "Rotten Tomatoes Audience Score",
    ]

    const cells = scoreColumns
        .map(col => csvHeaders.indexOf(col) + 1)
        .map(getCellInCol)

    // get a list of expressions to average

    const scoreExpressions: string[] = []

    for (const col of scoreColumns) {
        const score = csvHeaders.indexOf(col) + 1
        const cell = getCellInCol(score)

        // normalise the scores to be out of 100
        const multiplier = normalisationMultiplier(col)

        const expression = multiplier === 1
            ? cell
            : `(${cell} * ${multiplier})`

        scoreExpressions.push(expression)
    }

    // average the scores, ensure blank cells don't contribute to the average
    const average = `(${scoreExpressions.join(" + ")}) / ${count(cells)}`

    return `=IFERROR(${average}, "")`
})()

function normalisationMultiplier(col: CsvHeaders): number {
    switch (col) {
        case "IMDB Score":
        case "Metacritic User Score":
            return 10

        case "Metacritic Critic Score":
        case "Rotten Tomatoes Audience Score":
        case "Rotten Tomatoes Critic Score":
            return 1
    }

    return 1
}

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
