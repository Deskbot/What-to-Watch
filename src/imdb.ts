export type ImdbResult = {
    name: string,
    score: number | "not found" | "tbd",
}

export async function getImdbData(movie: string): Promise<ImdbResult> {
    const data = await search(movie)
}

function search(movie: string) {

}